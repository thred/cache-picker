/// <reference path="../imports.d.ts" />

import {Quantity} from "../../script/code/Quantity";

import * as Utils from "./Utils";

import {assert} from "chai";

export function testQuantityParser(language: string, s: string, result: string): void {
    it(`${s} (${language}) => ${result}`, () => {
        let quantity = Quantity.parse(language, s);

        assert.equal(quantity.toString(), result);
    });
}

describe("Quantity Parser", () => {

    testQuantityParser("en-US", "1.5 m", "1.5 m");
    testQuantityParser("en-US", "1 m 50 cm", "1.5 m");
    testQuantityParser("en-US", "1 m 50", "1.5 m");
    testQuantityParser("en-US", "1 500 cm", "1500 cm");

});