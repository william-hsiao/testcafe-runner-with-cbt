const createTestCafe = require("testcafe");
const cbtTunnelUtils = require("testcafe-browser-provider-cbt/lib/cbt/tunnels");
const request = require("request-promise");

// export default {
// }

let testcafe = null;
let filePath = "";
let browsers = [];
let hasFailed = false;

let queue = null;
let runnerPromises = [];
let runners = [];
let activeCount = 0;

MAX_AVAILABLE_THREADS = undefined;
MAX_THREADS = 1;

process.env.CBT_TUNNEL_NAME = "test123";

function run(browserss, filePaths) {
  createTestCafe()
    .then(async tc => {
      testcafe = tc;
      browsers = browserss;
      filePath = filePaths;

      console.log(browsers);
      console.log(filePath);

      if (!process.env.CBT_TUNNEL_NAME)
        await cbtTunnelUtils.generateTunnelName();
      await cbtTunnelUtils.openTunnel(() => {});

      MAX_AVAILABLE_THREADS = await request({
        method: "GET",
        uri: "https://crossbrowsertesting.com/api/v3/account/maxParallelLimits",
        auth: {
          user: process.env.CBT_USERNAME,
          pass: process.env.CBT_AUTHKEY
        },
        json: true,
        transform: body => body.automated
      });

      console.log("MAX AVAILABLE THREADS: ", MAX_AVAILABLE_THREADS);
    })

    .then(async () => {
      await new Promise((resolve, reject) => {
        queue = setInterval(async () => {
          const activeTestCounts = await request({
            method: "GET",
            uri:
              "https://crossbrowsertesting.com/api/v3/account/activeTestCounts",
            auth: {
              user: process.env.CBT_USERNAME,
              pass: process.env.CBT_AUTHKEY
            },
            json: true
          });

          if (
            MAX_AVAILABLE_THREADS !== activeTestCounts["team"]["automated"] &&
            MAX_THREADS > activeTestCounts["member"]["automated"] &&
            activeCount < MAX_THREADS
          ) {
            activeCount++;
            runnerPromises.push(
              new Promise(resolve => {
                const runner = testcafe.createRunner();
                runners.push(runner);

                resolve(
                  runner
                    .src(filePath)
                    .browsers(browsers[0])
                    .run()
                );
              }).then(failedCount => {
                activeCount--;
                if (failedCount > 0) {
                  hasFailed = true;
                  clearInterval(queue);

                  runners.forEach(runner => runner.cancel());
                  reject();
                }
              })
            );

            browsers.splice(0, 1);

            if (browsers.length === 0) {
              clearInterval(queue);

              await Promise.all(runnerPromises).then(() => {
                resolve();
              });
            }
          }
        }, 1000);
      });
    })

    .then(async () => {
      testcafe.close();
      await cbtTunnelUtils.closeTunnel();
      if (hasFailed) process.exit(1);
    });
}

run(
  ["cbt:Chrome@66:Windows 10", "cbt:Firefox@60:Windows 10"],
  "./sample-test.js"
);
