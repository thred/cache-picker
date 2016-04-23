import Scanner from "./Scanner";
import {Token, Tokenizer} from "./Tokenizer";
import {Program, Line} from "./Program";
import {Scope, Expression} from "./Expression";
import * as Expressions from "./Expressions";
import * as Operations from "./Operations";
import {Quantity, NumberBasedQuantity} from "./Quantity";
import {Unit} from "./Unit";
import * as Units from "./Units";

export class Context {

    isReferenceDefined(reference: string): boolean {
        return false;
    }

    isCallDefined(reference: string): boolean {
        return false;
    }

}

export class ParseError extends Error {

    constructor(private _line: number, private _column: number, private _message: string, private _cause?: any) {
        super(ParseError.format(_line, _column, _message, _cause));
    }

    get line(): number {
        return this._line;
    }

    get column(): number {
        return this._column;
    }

    get message(): string {
        return this._message;
    }

    get cause(): any {
        return this._cause;
    }

    static format(line: number, column: number, message: string, cause?: any) {
        let result = `[Ln ${line}, Col ${column}] ${message}`;

        if (cause) {
            result += `\nCaused by ${cause}`;
        }

        return result;
    }
}

export function scan(source: string): Scanner {
    return new Scanner(source);
}

export function parseExpression(scanner: Scanner): Expression {
    return new Parser(scanner).expression(new Context());
}

class Parser {

    private tokenizer: Tokenizer;

    constructor(scanner: Scanner) {
        this.tokenizer = new Tokenizer(scanner);
    }

    expression(context: Context): Expression {
        this.tokenizer.nextExpressionToken();

        return this.parseExpression(context);
    }

    /**
     *  Expression = ( ( UnaryOperator Expression) | ( "(" Expression ")" ) | Reference | Call | Constant ) { Unit [ Expression] } { Operator Expression }. 
     */
    private parseExpression(context: Context): Expression {
        let token = this.tokenizer.get();

        if (!this.isExpression(token)) {
            throw new ParseError(token.line, token.column, `Expected expression, but got: ${token.s}`);
        }

        let expression: Expression;

        if (this.isUnaryOperator(token)) {
            this.tokenizer.nextExpressionToken();

            let argument = this.parseExpression(context);

            if (token.s === "+") {
                expression = new Expressions.UnaryOperationExpression(token.line, token.column, token.s, Operations.positive, argument);
            }
            else if (token.s === "-") {
                expression = new Expressions.UnaryOperationExpression(token.line, token.column, token.s, Operations.negative, argument);
            }
            else {
                throw new ParseError(token.line, token.column, "Unsupported unary operation: " + token.s);
            }

            token = this.tokenizer.get();
        }
        else if (this.isOpeningParentheses(token)) {
            this.tokenizer.nextExpressionToken();

            let argument = this.parseExpression(context);
            let closingToken = this.tokenizer.nextExpressionToken();

            if (!this.isClosingParentheses(token)) {
                throw new ParseError(token.line, token.column, "Expected closing parentheses, but got: " + token.s);
            }

            token = this.tokenizer.get();
        }
        else if (this.isConstant(token)) {
            expression = this.parseConstant(context);

            token = this.tokenizer.get();
        }
        else {
            throw new ParseError(token.line, token.column, `Implementation missing for expression: ${token.s}`);
        }

        if (this.isUnit(token)) {
            let startToken = token;
            let unit = this.parseUnit(context);

// FIXME das geht da jetzt einfach nimmer...gehirn ist aus
//            expression = new Expressions.UnitExpression(startToken.line, startToken.column, unit, expression);

// FIXME the unit has to be smaller than the previous unit and of the same type of measurement
            token = this.tokenizer.nextExpressionToken();

            if ((!this.isOperator(token)) && (this.isExpression(token))) {
                expression = new Expressions.UnitExpression(startToken.line, startToken.column, unit, expression);
            }

            token = this.tokenizer.get();
        }

        // TODO operator precedence

        while (this.isOperator(token)) {
            let startToken = token;

            this.tokenizer.nextExpressionToken();

            if (startToken.s === "+") {
                expression = new Expressions.OperationExpression(startToken.line, startToken.column, "+", Operations.add, expression, this.parseExpression(context));

                token = this.tokenizer.get();
            }
        }

        return expression;
    }

    /**
     * Constant = Number | String. 
     */
    parseConstant(context: Context): Expression {
        let token = this.tokenizer.get();

        if (!this.isConstant(token)) {
            throw new ParseError(token.line, token.column, `Expected constant, but got: ${token.s}`);
        }

        if (this.isNumber(token)) {
            return this.parseNumber(context);
        }
        else if (this.isString(token)) {
            return this.parseString(context);
        }
        else {
            throw new ParseError(token.line, token.column, `Implementation missing for constant: ${token.s}`);
        }
    }

    /**
     * Value = number.
     */
    private parseNumber(context: Context): Expressions.QuantityExpression {
        let token = this.tokenizer.get();

        if (!this.isNumber(token)) {
            throw new ParseError(token.line, token.column, `Expected number, but got: ${token.s}`);
        }

        this.tokenizer.nextExpressionToken();

        return new Expressions.QuantityExpression(token.line, token.column, new NumberBasedQuantity(token.n));
    }

    /**
     * String = string-delimiter { string | reference | ( "${" Expression "}") } string-delimiter. 
     */
    private parseString(context: Context): Expressions.StringExpression {
        let startToken = this.tokenizer.get();

        if (!this.isString(startToken)) {
            throw new ParseError(startToken.line, startToken.column, `Expected string-delimiter, but got: ${startToken.s}`);
        }

        let expressions: Expression[] = [];
        let token = this.tokenizer.nextStringToken();

        while (true) {
            if (this.isEnd(token)) {
                throw new ParseError(startToken.line, startToken.column, "Unclosed string");
            }

            if (token.type === "string-delimiter") {
                break;
            }

            if (token.type === "string") {
                expressions.push(new Expressions.SegmentExpression(token.line, token.column, token.s));

                token = this.tokenizer.nextStringToken();

                continue;
            }

            if (token.type === "reference") {
                let name = token.s;

                if (!context.isReferenceDefined(name)) {
                    throw new ParseError(token.line, token.column, `Unknown reference: ${name}`);
                }

                expressions.push(new Expressions.ReferenceExpression(token.line, token.column, token.s))

                token = this.tokenizer.nextStringToken();

                continue;
            }

            if (this.isOpeningPlaceholder(token)) {
                let blockToken = this.tokenizer.nextExpressionToken();

                if (this.isEnd(blockToken)) {
                    throw new ParseError(token.line, token.column, "Unclosed block");
                }

                expressions.push(new Expressions.PlaceholderExpression(token.line, token.column, this.parseExpression(context)));

                token = this.tokenizer.get();

                if (!this.isClosingPlaceholder(token)) {
                    throw new ParseError(token.line, token.column, `Expected closing placeholder, but got: ${token.s}`);
                }

                token = this.tokenizer.nextStringToken();

                continue;
            }

            throw new ParseError(token.line, token.column, `Expected string content, but got: ${token.s}`);
        }

        this.tokenizer.nextExpressionToken();

        return new Expressions.StringExpression(startToken.line, startToken.column, expressions);
    }

    /**
     * Unit = unit.
     */
    private parseUnit(context: Context): Unit {
        let token = this.tokenizer.get();

        if (!this.isUnit(token)) {
            throw new ParseError(token.line, token.column, `Expected unit, but got: ${token.s}`);
        }

        this.tokenizer.nextExpressionToken();

        return Units.get(token.s);
    }


    isExpression(token: Token): boolean {
        return this.isUnaryOperator(token) || this.isOpeningParentheses(token) || this.isConstant(token);
    }

    isUnaryOperator(token: Token): boolean {
        if (!this.isOperator(token)) {
            return false;
        }

        return (token.s === "+") || (token.s === "-");
    }

    isOperator(token: Token, operator?: string): boolean {
        if (token.type === "operator") {
            return (!operator) || (operator === token.s);
        }

        if (token.type === "identifier") {

        }

        return false;
    }

    isOpeningParentheses(token: Token) {
        return this.isBrackets(token, "(");
    }

    isClosingParentheses(token: Token) {
        return this.isBrackets(token, ")");
    }

    isOpeningPlaceholder(token: Token) {
        return this.isBrackets(token, "${");
    }

    isClosingPlaceholder(token: Token) {
        return this.isBrackets(token, "}");
    }

    isBrackets(token: Token, brackets?: string): boolean {
        return (token.type === "brackets") && ((!brackets) || (brackets === token.s));
    }

    isConstant(token: Token): boolean {
        return this.isNumber(token) || this.isString(token);
    }

    isNumber(token: Token): boolean {
        return token.type === "number";
    }

    isString(token: Token): boolean {
        return token.type === "string-delimiter";
    }

    isUnit(token: Token): boolean {
        if ((token.type !== "identifier") && (token.type !== "string-delimiter") && (token.type !== "symbol")) {
            return false;
        }

        return Units.exists(token.s);
    }

    isEnd(token: Token): boolean {
        return token.type === "end";
    }

    isSymbol(token: Token, symbol: string): boolean {
        return (token.type === "symbol") && (token.s === symbol);
    }

}