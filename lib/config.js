const Conf = require("conf");
const editor = require("editor");
console.log(10, process.env, process.env.TGTG_CONF)
const defaults =
  process.env.TGTG_CONF
    ? JSON.parse(process.env.TGTG_CONF)
    : require("../config.defaults.json");

const config = new Conf({
  defaults,
  projectName: "toogoodtogo-watcher",
});

module.exports = {
  config,
  editConfig,
  resetConfig,
  configPath,
};

function editConfig() {
  editor(config.path);
  console.log(`Saved config at:  ${config.path}`);
}

function resetConfig() {
  config.set(defaults);
}

function configPath() {
  console.log(`The config is stored at: ${config.path}`);
}
