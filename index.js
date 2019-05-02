const createTestCafe = require("testcafe");
const cbtTunnelUtils = require("testcafe-browser-provider-cbt/lib/cbt/tunnels");
const request = require("request-promise");
const shortid = require("shortid");

export default {
  testcafe: null,
  filePath: "",
  browsers: [],
  hasFailed: false,
  
  queue: null,
  runnerInstances: [],
  runnerPromises: [],
  activeCount: 0,
  
  MAX_AVAILABLE_THREADS: 0,
  MAX_THREADS: 0,
  
  async getMaxParallelLimit() {
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
  },
  
  async getActiveTestCounts() {
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
  },
  
  async createRunnerInstance() {
    return new Promise(resolve => {
      const runner = this.testcafe.createRunner();
      const promise = runner.src(this.filePath).browsers(this.browsers[0]).reporter('json').run();
      this.runnerPromises.push(promise);
      resolve(promise);
    })
    .then(async failedCount => {
      this.activeCount--;
      if (failedCount > 0) this.hasFailed = true;
    })
  },
  
  async waitForTestsToComplete(resolve) {
    clearInterval(this.queue);
    return await Promise.all(this.runnerInstances).then(() => {
      resolve();
    });
  },
  
  async hasAvailableThread() {
    const activeTestCounts = await this.getActiveTestCounts();
    return this.MAX_AVAILABLE_THREADS !== activeTestCounts["team"]["automated"] &&
    this.MAX_THREADS > activeTestCounts["member"]["automated"] &&
    this.activeCount < this.MAX_THREADS
  },
  
  run(browsers, filePath, maxThreads = 1) {
    if (!process.env.CBT_TUNNEL_NAME)
      process.env.CBT_TUNNEL_NAME = `testcafe-${shortid.generate()}`;
  
    createTestCafe()
      .then(async tc => {
        this.testcafe = tc;
        this.browsers = browsers;
        this.filePath = filePath;
  
        this.MAX_AVAILABLE_THREADS = await this.getMaxParallelLimit();
        this.MAX_THREADS = maxThreads;
  
        if (!process.env.CBT_TUNNEL_NAME)
          await cbtTunnelUtils.generateTunnelName();
  
        await new Promise(resolve => {
          cbtTunnelUtils.openTunnel(() => {
            this.queue = setInterval(async () => {
              if (this.hasFailed) {
                this.browsers = [];
                return await this.waitForTestsToComplete(resolve);
              }
  
              if (await this.hasAvailableThread()) {
                this.runnerInstances.push(this.createRunnerInstance());
  
                this.activeCount++;
                this.browsers.splice(0, 1);
  
                if (this.browsers.length === 0) return await this.waitForTestsToComplete(resolve);
              }
            }, 3000);
          });
        });
      })
      .then(async () => {
        this.testcafe.close();
        await cbtTunnelUtils.closeTunnel();
        if (this.hasFailed) process.exit(1);
      })
  }
}
