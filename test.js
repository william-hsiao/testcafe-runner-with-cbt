import cbtRunner from './index';

cbtRunner.run(
  ["cbt:Chrome@66:Windows 10", "cbt:Firefox@60:Windows 10", "cbt:Chrome@66:Windows 10", "cbt:Firefox@60:Windows 10"],
  "./sample-test.js",
  2
);
