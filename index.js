const { APIGatewayProxyResult } = require('aws-lambda');
const axios = require('axios');
const AWS = require('aws-sdk'); // Using the AWS SDK package directly
const { API_TOKEN } = require('./credentials');

// https://test-bucket-for-todoist-weekly-review.s3.us-east-2.amazonaws.com/deployment_package.zip

const TASK_ENDPOINT = 'https://api.todoist.com/rest/v2/tasks';

const filters = [
    {
      filterString: '/Fixed date & overdue',
      groupAndSort: function (tasks) {
        let groupedTasks = new Map();
        const unsortedGroups = new Map();

        tasks.forEach((task) => {
          const projectId = task.project_id;
          if (!unsortedGroups.has(projectId)) {
            unsortedGroups.set(projectId, []);
          }
          unsortedGroups.get(projectId).push(task);
        });

        projectsOrder.forEach((projectId) => {
          if (unsortedGroups.has(projectId)) {
            const sortedTasks = unsortedGroups.get(projectId).sort((a, b) => a.due.date.localeCompare(b.due.date));
            if (sortedTasks) {
              groupedTasks.set(projectId, sortedTasks);
            }
          }
        });

        return groupedTasks;
      },
    },
    {
      filterString: '/Fixed date & due before: next Monday & !overdue',
      groupAndSort: function (tasks) {
        let groupedTasks = new Map();
        const unsortedGroups = new Map();

        tasks.forEach((task) => {
          const projectId = task.project_id;
          if (!unsortedGroups.has(projectId)) {
            unsortedGroups.set(projectId, []);
          }
          unsortedGroups.get(projectId).push(task);
        });

        projectsOrder.forEach((projectId) => {
          if (unsortedGroups.has(projectId)) {
            const sortedTasks = unsortedGroups.get(projectId).sort((a, b) => a.due.date.localeCompare(b.due.date));
            if (sortedTasks) {
              groupedTasks.set(projectId, sortedTasks);
            }
          }
        });

        return groupedTasks;
      },
    },
    {
      filterString: '/Chore rotation & (overdue | due: Sunday)',
      groupAndSort: function (tasks) {
        const sortedTasks = tasks.sort((a, b) => a.due.date.localeCompare(b.due.date));
        return new Map([[tasks[0].project_id, sortedTasks]]);
      },
    },
    {
      filterString: '(due: Sunday|overdue) & !/Fixed date & !##Work & !/Chore rotation',
      groupAndSort: function (tasks) {
        let groupedTasks = new Map();
        const unsortedGroups = new Map();

        tasks.forEach((task) => {
          const projectId = task.project_id;
          if (!unsortedGroups.has(projectId)) {
            unsortedGroups.set(projectId, []);
          }
          unsortedGroups.get(projectId).push(task);
        });

        projectsOrder.forEach((projectId) => {
          if (unsortedGroups.has(projectId)) {
            const sortedTasks = unsortedGroups.get(projectId).sort((a, b) => a.due.date.localeCompare(b.due.date));
            if (sortedTasks) {
              groupedTasks.set(projectId, sortedTasks);
            }
          }
        });

        return groupedTasks;
      },
    },
  ];


const report = new Map([
  ['Top 14', []],
  ['Remaining', []],
  ['Queues', []]
]);

let reachedOverflow = false;

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
    return 'Remaining';
  }

  if (report.get('Top 14').length < 14) {
    return 'Top 14';
  }

  reachedOverflow = true;
  return 'Remaining';
}

async function generateReport() {
  try {
    for (const f in filters) {
      const response = await axios.get(TASK_ENDPOINT, {
        headers: {
          Authorization: `Bearer ${API_TOKEN}`,
        },
        params: {
          filter: filters[f].filterString
        }
      });

      const sortedTasks = filters[f].groupAndSort(response.data);

      sortedTasks.forEach((tasks, projectId) => {
        for (let task of tasks) {
          report.get(getCurrentHeader()).push({
            content: task.content,
            projectName: projectId,
            dueDate: task.due.date,
            filter: filters[f].filterString
          });
        }
      });
    }
  } catch (error) {
    console.error(error);
    throw error;
  }

  return report;
}

async function sendReport(report) {
  console.log("Sending report");
  console.log(report);

  let ses = new AWS.SES();

  // config.update({region: 'us-east-2'})

  const topTasksFormatted = report.get('Top 14').map(data => {
    return `
      <tr>
        <td>${data.content}</td>
        <td>${data.projectName}</td>
        <td>${data.dueDate}</td>
      </tr>`
  }).join('')

  const topTasksEmailSection = `
    <div>
      <h1>Top 14 tasks</h1>
      <table>
        <tr>
          <th>Task name</th>
          <th>Project name</th>
          <th>Due date</th>
        </tr>
        ${topTasksFormatted}
      </table>
    </div>`

  const remainingTasksFormatted = report.get('Remaining').length > 0 &&
    report.get('Remaining').map(data => {
      return `
        <tr>
          <td>${data.content}</td>
          <td>${data.projectName}</td>
          <td>${data.dueDate}</td>
        </tr>`
    })

  const remainingTasksEmailSection = report.get('Remaining').length > 0 ? `
    <div>
        <h1>Remaining assigned tasks</h1>
        <table>
          <tr>
            <th>Task name</th>
            <th>Project name</th>
            <th>Due date</th>
          </tr>
          ${remainingTasksFormatted}
        </table>
    </div>` : ''

  const htmlEmailTemplate = `
    <div>
        <p>
            Here is the task report for the upcoming week.
        </p>
        ${topTasksEmailSection}
        ${remainingTasksEmailSection}
    </div>`

  const params = {
    Destination: {
      ToAddresses: [
        'nelson.blaken@gmail.com',
      ]
    },
    Message: {
      Body: {
        Html: {
          Charset: "UTF-8",
          Data: htmlEmailTemplate
        },
      },
      Subject: {
        Charset: 'UTF-8',
        Data: "Weekly Report"
      }
    },
    Source: 'nelson.blaken@gmail.com',
  }

  const data = await ses.sendEmail(params).promise()
  console.log(data.MessageId)
}

const handler = async (event, context) => {
  console.log(`Event: ${JSON.stringify(event, null, 2)}`);
  console.log(`Context: ${JSON.stringify(context, null, 2)}`);

  const reportToSend = await generateReport();
  console.log("Sending report")
  await sendReport(reportToSend);

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Report generated and sent via Node',
    }),
  };
};

module.exports = { handler };

// TODO: Investigate if I can create a different zip using typescript
// If I can't create the zip using typescript, maybe there are more streamlined ways of doing the deployment
// First step is probably getting the timer set up correctly, then converting things to typescript