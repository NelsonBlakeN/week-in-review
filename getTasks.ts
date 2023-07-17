import axios from 'axios'
const util = require('util')
const API_TOKEN = '7ae73ab884f0b45af921fc646a2787eb3def9d5d';

interface Task {
  id: string;
  project_id: string;
  due: {
    date: string;
  };
  content: string;
}

const WORK_FILTER_ID = '2336225525'
const RESPONSIBILITIES_QUEUE = '2332618756'
const ACTIVE_PROJECTS_QUEUE = '2339564398'
const TOMORROW_QUEUE = '2331337042'

const filtersToSkip = [
  WORK_FILTER_ID,
  RESPONSIBILITIES_QUEUE,
  ACTIVE_PROJECTS_QUEUE,
  TOMORROW_QUEUE
]

const projectsOrder = [
  '2155628036', '2303052907', '2315597514', '2255425331',
  '2303053885', '2286704076', '2239149688', '2303052901',
  '2239149781', '2302539351', '2304032931', '2304032780',
  '2310076840', '2301640874', '2290056625', '2301754909',
  '2297991071', '2155630577', '2286812851', '2272637270',
  '2298384388', '2298100835', '2300035739', '2298100837',
  '2298100836', '2297630460', '2290056777', '2298100838',
  '2299491561', '2249710309', '2303053899', '2302064342',
  '2297564363', '2297564382', '2298135558', '2298135996',
  '2270037482', '2298291516', '2298291708', '2300064891',
  '2297564416', '2260304064', '2287052310', '2214035701',
  '2214035741', '2214035745', '2214035751', '2214035764',
  '2214046659', '2214066347', '2214097118', '2214297185',
  '2312829090', '2286682174', '2289518157', '2239149660',
  '2286682144', '2290056703', '2312829248', '2314209687',
  '2296608472', '2312829323', '2312829416', '2312829376',
  '2312828819', '2312828833', '2312828847', '2312828861',
  '2312828935', '2312828966', '2312829030', '2312829441'
];

function groupAndSortTasks(tasks: Task[], filterId: string): Map<string, string[]> {
  let groupedTasks = new Map<string, string[]>();

  if (filterId === '2336271337' || filterId === '2334565705') {
    const unsortedGroups = new Map<string, Task[]>();

    tasks.forEach((task) => {
      const projectId = task.project_id
      if (!unsortedGroups.has(projectId)) {
        unsortedGroups.set(projectId, [])
      }
      unsortedGroups.get(projectId)?.push(task)
    })

    projectsOrder.forEach((projectId) => {
      if (unsortedGroups.has(projectId)) {
        const sortedTasks = unsortedGroups.get(projectId)?.sort((a, b) => a.due.date.localeCompare(b.due.date))
        if (sortedTasks) {
          groupedTasks.set(projectId, sortedTasks.map(t => t.content))
        }
      }
    });
  } else if (filterId === '2333322928') {
    const sortedTasks = tasks.sort((a, b) => a.due.date.localeCompare(b.due.date));
    groupedTasks.set(filterId, sortedTasks.map(t => t.content));
  }

  return groupedTasks;
}

async function getAllTasksFromFavoriteFilters() {
  try {
    // Fetch filters
    const filtersResponse = await axios.get('https://api.todoist.com/sync/v9/sync', {
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
      },
      params: {
        resource_types: '["filters"]'
      }
    });
    const filters = filtersResponse.data.filters

    // Filter favorite filters
    const favorites = filters.filter((filter) => filter.is_favorite && !filtersToSkip.includes(filter.id));

    // Fetch tasks for each favorite filter
    const tasks: Task[] = [];

    for (const favorite of favorites) {
      const tasksResponse = await axios.get(
        `https://api.todoist.com/rest/v2/tasks`,
        {
          headers: {
            Authorization: `Bearer ${API_TOKEN}`,
          },
          params: {
            filter: favorite.query
          }
        }
      );

      const groupedTasks = groupAndSortTasks(tasksResponse.data, favorite.id)
      console.log(favorite.name, ':', groupedTasks)

      const filterTasks = tasksResponse.data.filter((t: Task) => t.due !== null);
      tasks.push(...filterTasks);
    }

    return tasks;
  } catch (error) {
    console.error('Error fetching tasks from favorite filters:', error);
    throw error;
  }
}

getAllTasksFromFavoriteFilters()
  .then((tasks) => {
    // Process the tasks as needed
    console.log(tasks?.length);
  })
  .catch((error) => {
    // Handle errors
    console.error(error);
  });
