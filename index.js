const { APIGatewayProxyResult } = require('aws-lambda');
const axios = require('axios');
const AWS = require('aws-sdk'); // Using the AWS SDK package directly
const { API_TOKEN } = require('./credentials');

// https://test-bucket-for-todoist-weekly-review.s3.us-east-2.amazonaws.com/deployment_package.zip

const TASK_ENDPOINT = 'https://api.todoist.com/rest/v2/tasks';

const filters = [
    {
      filterString: '/Fixed date & overdue',
      groupAndSort: function (tasks, projectOrder) {
        let groupedTasks = new Map();
        const unsortedGroups = new Map();

        tasks.forEach((task) => {
          const projectId = task.project_id;
          if (!unsortedGroups.has(projectId)) {
            unsortedGroups.set(projectId, []);
          }
          unsortedGroups.get(projectId).push(task);
        });

        projectOrder.forEach((projectId) => {
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
      groupAndSort: function (tasks, projectOrder) {
        let groupedTasks = new Map();
        const unsortedGroups = new Map();

        tasks.forEach((task) => {
          const projectId = task.project_id;
          if (!unsortedGroups.has(projectId)) {
            unsortedGroups.set(projectId, []);
          }
          unsortedGroups.get(projectId).push(task);
        });

        projectOrder.forEach((projectId) => {
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
      groupAndSort: function (tasks, projectOrder) {
        const sortedTasks = tasks.sort((a, b) => a.due.date.localeCompare(b.due.date));
        return new Map([[tasks[0].project_id, sortedTasks]]);
      },
    },
    {
      filterString: '(due: Sunday|overdue) & !/Fixed date & !##Work & !/Chore rotation',
      groupAndSort: function (tasks, projectOrder) {
        let groupedTasks = new Map();
        const unsortedGroups = new Map();

        tasks.forEach((task) => {
          const projectId = task.project_id;
          if (!unsortedGroups.has(projectId)) {
            unsortedGroups.set(projectId, []);
          }
          unsortedGroups.get(projectId).push(task);
        });

        projectOrder.forEach((projectId) => {
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
    const projectData = (await axios.get("https://api.todoist.com/rest/v2/projects", {
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
      }
    })).data
    const projects = new Map(projectData.map(proj => [proj.id, proj.name]))
    const projectOrder = projectData.map(obj => obj.id)

    for (const f in filters) {
      const response = await axios.get(TASK_ENDPOINT, {
        headers: {
          Authorization: `Bearer ${API_TOKEN}`,
        },
        params: {
          filter: filters[f].filterString
        }
      });

      const sortedTasks = filters[f].groupAndSort(response.data, projectOrder);

      sortedTasks.forEach((tasks, projectId) => {
        for (let task of tasks) {
          report.get(getCurrentHeader()).push({
            content: task.content,
            projectName: projects.get(projectId),
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

module.exports = { handler, generateReport };

// TODO: Investigate if I can create a different zip using typescript
// If I can't create the zip using typescript, maybe there are more streamlined ways of doing the deployment
// First step is probably getting the timer set up correctly, then converting things to typescript