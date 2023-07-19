import axios from 'axios'
import { API_TOKEN } from './credentials';

interface Task {
  id: string;
  project_id: string;
  due: {
    date: string;
  };
  content: string;
}

interface ReportInfo {
  content: string,
  projectName: string,
  dueDate: string,
  filter: string,
}

const filters = [
  {
    filterString: '/Fixed date & overdue',
    groupAndSort: (tasks: Task[]) => {
      let groupedTasks = new Map<string, Task[]>();
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
            groupedTasks.set(projectId, sortedTasks)
          }
        }
      });

      return groupedTasks
    },
  },
  {
    filterString: '/Fixed date & due before: Monday & !overdue',
    groupAndSort: (tasks: Task[]) => {
      // Grouped by sorted project, sorted by due date
      let groupedTasks = new Map<string, Task[]>();
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
            groupedTasks.set(projectId, sortedTasks)
          }
        }
      });

      return groupedTasks
    },
  },
  {
    filterString: '/Chore rotation & (overdue | due: Sunday)',
    groupAndSort: (tasks: Task[]) => {
      const sortedTasks = tasks.sort((a, b) => a.due.date.localeCompare(b.due.date));
      return new Map<string, Task[]>([
        [tasks[0].project_id, sortedTasks]
      ])
    },
  },
  {
    filterString: '(due: Sunday|overdue) & !/Fixed date & !##Work & !/Chore rotation',
    groupAndSort: (tasks: Task[]) => {
      // Grouped by sorted project, sorted by due date
      let groupedTasks = new Map<string, Task[]>();
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
            groupedTasks.set(projectId, sortedTasks)
          }
        }
      });

      return groupedTasks
    },
  },
]

const TASK_ENDPOINT = 'https://api.todoist.com/rest/v2/tasks'
const SYNC_ENDPOINT = 'https://api.todoist.com/sync/v9/sync'

const report = new Map<string, ReportInfo[]>([
  ['Top 14', []],
  ['Remaining', []],
  ['Queues', []]
])

let reachedOverflow = false

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

function getCurrentHeader() {
  if (reachedOverflow) {
    return 'Remaining'
  }

  if (report.get('Top 14')!.length < 14) {
    return 'Top 14'
  }

  reachedOverflow = true
  return 'Remaining'
}

async function generateReport() {
  for (const f in filters) {
    await axios.get(TASK_ENDPOINT, {
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
      },
      params: {
        filter: filters[f].filterString
      }
    })
    .then(response => {
      const sortedTasks = filters[f].groupAndSort(response.data)
      sortedTasks.forEach((tasks, projectId) => {
        for (let task of tasks) {
          report.get(getCurrentHeader())?.push({
            content: task.content,
            projectName: projectId,
            dueDate: task.due.date,
            filter: filters[f].filterString
          })
        }
      })
    })
    .catch(error => {
      console.log(error)
    })
  }

  // TODO: If necessary, get queue tasks
}

async function sendReport() {
  console.log('Sending report')
  console.log(report)
}

generateReport()
  .then(() => {
    sendReport()
  })
