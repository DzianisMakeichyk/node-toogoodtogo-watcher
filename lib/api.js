const _ = require("lodash");
const got = require("got");
const { config } = require("./config");

const api = got.extend({
  prefixUrl: "https://apptoogoodtogo.com/api/",
  headers: _.defaults(config.get("api.headers"), {
    "Content-Type": "application/json",
    Accept: "application/json",
    "Accept-Language": "en-US",
  }),
  responseType: "json",
  resolveBodyOnly: true,
});

module.exports = {
  login,
  listFavoriteBusinesses,
};

function login() {
  const session = getSession();
  return session.refreshToken ? refreshToken() : loginByEmail();
}

function loginByEmail() {
  console.log("Login...");
  return api
    .post("auth/v1/loginByEmail", {
      json: {
        device_type: "UNKNOWN",
        email: process.env.EMAIL,
        password: process.env.PASSWORD,
      },
    })
    .then(createSession);
}

function refreshToken() {
  const session = getSession();

  return api
    .post("auth/v1/token/refresh", {
      json: {
        refresh_token: session.refreshToken,
      },
    })
    .then(updateSession);
}

function listFavoriteBusinesses() {
  const session = getSession();

  return api.post("item/v5/", {
    json: {
      favorites_only: true,
      origin: {
        latitude: process.env.LOCATION_LATITUDE,
        longitude: process.env.LOCATION_LONGITUDE,
      },
      radius: process.env.LOCATION_RADIUS,
      user_id: session.userId,
    },
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
    },
  });
}

function getSession() {
  return config.get("api.session") || {};
}

function createSession(login) {
  config.set("api.session", {
    userId: login.startup_data.user.user_id,
    accessToken: login.access_token,
    refreshToken: login.refresh_token,
  });
  return login;
}

function updateSession(token) {
  config.set("api.session.accessToken", token.access_token);
  return token;
}
