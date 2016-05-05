import {Definition} from "./Definition";
import {Command} from "./Command";
import {List} from "./List";
import {Map} from "./Map";
import {Quantity} from "./Quantity";
import {Unit} from "./Unit";

import * as Utils from "./Utils";

export class Scope {

    private values: { [name: string]: any } = {};

    constructor(private _parent: Scope) {
    }

    derive(params?: { [name: string]: any }): Scope {
        return new Scope(this).put(params);
    }

    get parent(): Scope {
        return this._parent;
    }

    get(name: string, defaultValue?: any): any {
        let value = this.values[name];

        if (value === undefined) {
            let scope: Scope = this;

            while ((value === undefined) && (scope.parent)) {
                scope = scope.parent;
                value = scope.values[name];
            }
        }

        if ((value === undefined) || (value === null)) {
            if (defaultValue !== undefined) {
                return defaultValue;
            }

            return value;
        }

        // if (value instanceof Command) {
        //     value = (value as Command).invoke(this);
        // }

        return value;
    }

    getAsList(name: string): List {
        return this.asList(this.get(name));
    }

    getAsMap(name: string): Map {
        return this.asMap(this.get(name));
    }

    getAsQuantity(name: string, defaultValue?: Quantity): Quantity {
        return this.asQuantity(this.get(name, defaultValue));
    }

    getAsString(name: string, defaultValue?: string): string {
        return this.asString(this.get(name, defaultValue));
    }

    getAsUnit(name: string, defaultValue?: Unit): Unit {
        return this.asUnit(this.get(name, defaultValue));
    }

    invoke(name: string, args?: { [name: string]: any }): any {
        let implementation = Utils.required(this.get(name), `Required procedure implementation is not defined: ${name}`);

        try {
            return implementation(this.derive(args));
        }
        catch (error) {
            throw new Error(`Invocation failed: ${name}.\n\tcaused by ${error}`);
        }
    }

    required(name: string): any {
        return Utils.required(this.get(name), `Required value is not defined: ${name}`);
    }

    requiredAsList(name: string): List {
        return Utils.required(this.getAsList(name), `Required list is not defined: ${name}`);
    }

    requiredAsMap(name: string): Map {
        return Utils.required(this.getAsMap(name), `Required map is not defined: ${name}`);
    }

    requiredAsQuantity(name: string): Quantity {
        return Utils.required(this.getAsQuantity(name), `Required quantity is not defined: ${name}`);
    }

    requiredAsString(name: string): string {
        return Utils.required(this.getAsString(name), `Required string is not defined: ${name}`);
    }

    requiredAsUnit(name: string): Unit {
        return Utils.required(this.getAsUnit(name), `Required unit is not defined: ${name}`);
    }

    put(values?: { [name: string]: any }): Scope {
        if (values) {
            for (var name in values) {
                this.set(name, values[name]);
            }
        }

        return this;
    }

    register(definition: Definition): Scope {
        return this.set(definition.name, definition);
    }

    set(name: string, value: any): Scope {
        this.values[name] = value;

        return this;
    }

    asList(value: any): List {
        if (value instanceof List) {
            return value;
        }

        try {
            return this.invoke("asList", { value: value });
        }
        catch (error) {
            throw new Error(`Conversion to Unit failed: ${value}\n\tcaused by ${error}`);
        }
    }

    asMap(value: any): Map {
        if (value instanceof Map) {
            return value;
        }

        try {
            return this.invoke("asMap", { value: value });
        }
        catch (error) {
            throw new Error(`Conversion to Unit failed: ${value}\n\tcaused by ${error}`);
        }
    }

    asQuantity(value: any): Quantity {
        if (value instanceof Quantity) {
            return value;
        }

        try {
            return this.invoke("asQuantity", { value: value });
        }
        catch (error) {
            throw new Error(`Conversion to Unit failed: ${value}\n\tcaused by ${error}`);
        }
    }

    asString(value: any): string {
        if (typeof value === "string") {
            return value;
        }

        try {
            return this.invoke("asString", { value: value });
        }
        catch (error) {
            throw new Error(`Conversion to Unit failed: ${value}\n\tcaused by ${error}`);
        }
    }

    asUnit(value: any): Unit {
        if (value instanceof Unit) {
            return value;
        }

        try {
            return this.invoke("asUnit", { value: value });
        }
        catch (error) {
            throw new Error(`Conversion to Unit failed: ${value}\n\tcaused by ${error}`);
        }
    }
}