/// <reference path="../imports.d.ts" />

import * as Test from "./Test";

describe("Parser (Basic)", () => {

    Test.script("true", "true");
    Test.script("42.1", "42.1");
    Test.script("\"a string\"", "\"a string\"");
    // Test.script("\"a ${2}nd string\\u0021\"", "\"a 2nd string!\"");

});
