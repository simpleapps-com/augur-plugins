// The augur-services skill's openapi-op script: one operation out of an OpenAPI document, with the
// path's shared parameters and its local `$ref`s resolved, and a clear error for every bad input.
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  checkArgs,
  runOpenapiOp,
} from "../../plugins/augur-build/skills/augur-services/scripts/openapi-op-cli.ts";

const DOC = {
  openapi: "3.1.0",
  paths: {
    "/items/{id}": {
      parameters: [{ $ref: "#/components/parameters/Id" }],
      get: {
        responses: { "200": { $ref: "#/components/responses/Item" } },
      },
      post: { requestBody: { $ref: "#/components/requestBodies/Missing" } },
    },
    "/items": { get: { parameters: [{ $ref: "#/components/parameters/Tilde~0Slash~1" }] } },
    "/loop": { get: { responses: { "200": { $ref: "#/components/schemas/Node" } } } },
    "/odd": {
      get: {
        x: [{ $ref: "#/list/1" }, { $ref: "#/list/0/deeper" }, { $ref: "other.json#/a" }],
      },
    },
  },
  list: ["plain", { found: true }],
  components: {
    parameters: {
      Id: { name: "id", in: "path", required: true, schema: { type: "integer" } },
      "Tilde~Slash/": { name: "q", in: "query" },
    },
    responses: {
      Item: { content: { "application/json": { schema: { $ref: "#/components/schemas/Item" } } } },
    },
    schemas: {
      Item: { type: "object", properties: { itemId: { type: "string", maxLength: 40 } } },
      Node: { type: "object", properties: { next: { $ref: "#/components/schemas/Node" } } },
    },
  },
};

const TEXT = JSON.stringify(DOC);

function run(method: string, path: string, text = TEXT) {
  const result = runOpenapiOp(text, method, path);
  return { code: result.code, body: JSON.parse(result.output) as Record<string, unknown> };
}

test("one operation, with the path's shared parameters and its refs resolved", () => {
  const { code, body } = run("get", "/items/{id}");
  assert.equal(code, 0);
  assert.equal(body.method, "GET");
  assert.equal(body.path, "/items/{id}");
  assert.deepEqual(body.sharedParameters, [DOC.components.parameters.Id]);
  assert.deepEqual(body.operation, {
    responses: {
      "200": {
        content: { "application/json": { schema: DOC.components.schemas.Item } },
      },
    },
  });
});

test("the method is matched without regard to case; a path with no shared parameters gives []", () => {
  const { code, body } = run("GET", "/items");
  assert.equal(code, 0);
  assert.deepEqual(body.sharedParameters, []);
  assert.deepEqual(body.operation, { parameters: [DOC.components.parameters["Tilde~Slash/"]] });
});

test("a ref already being expanded stays a ref, marked as a cycle", () => {
  const { body } = run("get", "/loop");
  assert.deepEqual(body.operation, {
    responses: {
      "200": {
        type: "object",
        properties: { next: { $ref: "#/components/schemas/Node", cycle: true } },
      },
    },
  });
});

test("refs into arrays resolve; refs that lead nowhere, or outside the document, are marked", () => {
  assert.deepEqual(run("post", "/items/{id}").body.operation, {
    requestBody: { $ref: "#/components/requestBodies/Missing", unresolved: true },
  });
  assert.deepEqual(run("get", "/odd").body.operation, {
    x: [
      { found: true },
      { $ref: "#/list/0/deeper", unresolved: true },
      { $ref: "other.json#/a", unresolved: true },
    ],
  });
});

test("a missing path names the paths near it; a missing method names the ones there", () => {
  const path = run("get", "/item");
  assert.equal(path.code, 1);
  assert.deepEqual(path.body, { error: "no path /item", near: ["/items/{id}", "/items"] });
  const method = run("delete", "/items/{id}");
  assert.equal(method.code, 1);
  assert.deepEqual(method.body, { error: "no DELETE on /items/{id}", methods: ["GET", "POST"] });
});

test("bad input exits 2: not JSON, not OpenAPI, not an HTTP method", () => {
  assert.deepEqual(run("get", "/items", "{"), {
    code: 2,
    body: { error: "the file is not JSON" },
  });
  for (const text of ["[]", "{}", '{"paths":[]}']) {
    assert.deepEqual(run("get", "/items", text), {
      code: 2,
      body: { error: "no paths: not an OpenAPI document" },
    });
  }
  assert.deepEqual(run("fetch", "/items"), {
    code: 2,
    body: { error: "not an HTTP method: fetch" },
  });
});

test("checkArgs wants exactly a file, a method and a path", () => {
  assert.equal(checkArgs(["openapi.json", "GET", "/items"]), undefined);
  for (const args of [[], ["openapi.json", "GET"], ["a", "b", "c", "d"]]) {
    assert.deepEqual(checkArgs(args), {
      code: 2,
      output: JSON.stringify({
        error: "usage: openapi-op.ts <openapi.json file> <METHOD> <path>",
      }),
    });
  }
});
