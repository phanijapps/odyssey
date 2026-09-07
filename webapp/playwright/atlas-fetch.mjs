// Test-process transport substitution: exercise the production URL guard and
// completion SDK without sending requests to an operator's running model.
const fetch = globalThis.fetch;
globalThis.fetch = (input, options) => {
  const url = new URL(input instanceof Request ? input.url : input);
  if (url.origin === "http://127.0.0.1:11434") {
    url.port = "19432";
    input = input instanceof Request ? new Request(url, input) : url;
  }
  return fetch(input, options);
};
