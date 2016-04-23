export enum TypeOfMeasurement {
    TIME,
    LENGTH,
    AREA,
    VOLUME,
    MASS,
    TEMPERATURE,
    ANGLE
};

export class Unit {

    constructor(private _symbol: string, private _name: string, private _typeOfMeasurement: TypeOfMeasurement,
        private _multiplier: number, private _subUnit?: Unit, private _baseUnit?: Unit, private _dimension: number = 1) {

    }

    get symbol(): string {
        return this._symbol;
    }

    get name(): string {
        return this._name;
    }

    get typeOfMeasurement(): TypeOfMeasurement {
        return this._typeOfMeasurement;
    }

    get multiplier(): number {
        return this._multiplier;
    }

    get subUnit(): Unit {
        return this._subUnit;
    }

    get baseUnit(): Unit {
        return this._baseUnit;
    }

    get dimension(): number {
        return this._dimension;
    }
}
