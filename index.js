const createTestCafe = require("testcafe");
const cbtTunnelUtils = require("testcafe-browser-provider-cbt/lib/cbt/tunnels");
const request = require("request-promise");
const shortid = require("shortid");

// export default {
// }

let testcafe = null;
let runner = null;
let filePath = "";
let browsers = [];
let hasFailed = false;

let queue = null;
let runnerInstances = [];
let runnerPromises = [];
let activeCount = 0;

MAX_AVAILABLE_THREADS = undefined;
MAX_THREADS = 2;

async function getMaxParallelLimit() {
  return request({
    method: "GET",
    uri: "https://crossbrowsertesting.com/api/v3/account/maxParallelLimits",
    auth: {
      user: process.env.CBT_USERNAME,
      pass: process.env.CBT_AUTHKEY
    },
    json: true,
    transform: body => body.automated
  });
}

async function getActiveTestCounts() {
  return request({
    method: "GET",
    uri:
      "https://crossbrowsertesting.com/api/v3/account/activeTestCounts",
    auth: {
      user: process.env.CBT_USERNAME,
      pass: process.env.CBT_AUTHKEY
    },
    json: true
  });
}

async function createRunnerInstance() {
  return new Promise(resolve => {
    promise = runner.src(filePath).browsers(browsers[0]).reporter('json').run();
    
    runnerPromises.push(promise);
    resolve(promise);
  })
  .then(async failedCount => {
    activeCount--;
    if (failedCount > 0) hasFailed = true;
  })
}

function run(browserss, filePaths) {
  if (!process.env.CBT_TUNNEL_NAME)
    process.env.CBT_TUNNEL_NAME = `testcafe-${shortid.generate()}`;

  createTestCafe()
    .then(async tc => {
      testcafe = tc;
      runner = tc.createRunner();
      browsers = browserss;
      filePath = filePaths;

      MAX_AVAILABLE_THREADS = await getMaxParallelLimit();

      if (!process.env.CBT_TUNNEL_NAME)
        await cbtTunnelUtils.generateTunnelName();

      await new Promise(resolve => {
        cbtTunnelUtils.openTunnel(() => {

          queue = setInterval(async () => {
            const activeTestCounts = await getActiveTestCounts();

            if (hasFailed) {
              browsers = [];
              clearInterval(queue);

              await Promise.all(runnerInstances).then(() => {
                resolve();
              });
            } else if (
              MAX_AVAILABLE_THREADS !== activeTestCounts["team"]["automated"] &&
              MAX_THREADS > activeTestCounts["member"]["automated"] &&
              activeCount < MAX_THREADS
            ) {
              runnerInstances.push(createRunnerInstance());

              activeCount++;
              browsers.splice(0, 1);

              if (browsers.length === 0) {
                clearInterval(queue);

                await Promise.all(runnerInstances).then(() => {
                  resolve();
                });
              }
            }
          }, 3000);
        });
      });
    })
    .then(async () => {
      testcafe.close();
      await cbtTunnelUtils.closeTunnel();
      if (hasFailed) process.exit(1);
    })
}

run(
  ["cbt:Chrome@66:Windows 10", "cbt:Firefox@60:Windows 10"],
  "./sample-test.js"
);
