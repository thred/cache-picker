import {Command} from "./Command";
import {Context} from "./Context";
import {Identifier} from "./Identifier";
import {Quantity} from "./Quantity";
import {Scanner} from "./Scanner";
import {Token, Tokenizer} from "./Tokenizer";
import {Unit} from "./Unit";

import * as Commands from "./Commands";
import * as Units from "./Units";
import * as Utils from "./Utils";

import {msg} from "./../Msg";

enum Precedence {
    Undefined,
    Assignment,
    Conditional,
    LogicalOr,
    LogicalAnd,
    BitwiseOr,
    BitwiseXOr,
    BitweiseAnd,
    Equality,
    Compare,
    Shift,
    Addition,
    Multiplication,
    Power,
    Unary,
    Unit,
    Call,
    Access,
    Group
}

export class Parser {

    private tokenizer: Tokenizer;

    constructor(scanner: Scanner) {
        this.tokenizer = new Tokenizer(scanner);

        this.tokenizer.nextExpressionToken();
    }

    isStatement(context: Context, token: Token): boolean {
        return (this.isUnaryOperator(context, token)) || (this.isExpressionChain(context, token));
    }

    /**
     *  Statement = [ UnaryOperator ] ExpressionChain { Operator [ Statement ] }. 
     */
    parseStatement(context: Context, minimumPrecedence: Precedence = Precedence.Undefined, leadingUnit?: Unit): Command {
        let token = this.tokenizer.get();

        if (!this.isStatement(context, token)) {
            throw new Error(Utils.formatError(token.line, token.column, `Expected statement, but found: ${token.s}`));
        }

        let expression: Command;

        if (this.isUnaryOperator(context, token)) {
            this.tokenizer.nextExpressionToken();

            let arg = this.parseExpressionChain(context);

            if (token.s === "+") {
                expression = new Commands.UnaryOperation(token.line, token.column, "positiveOf", token.s, arg);
            }
            else if (token.s === "-") {
                expression = new Commands.UnaryOperation(token.line, token.column, "negativeOf", token.s, arg);
            }
            else {
                throw new Error(Utils.formatError(token.line, token.column, `Unsupported unary operation: ${token.s}`));
            }

            token = this.tokenizer.get();
        }
        else {
            expression = this.parseExpressionChain(context);
        }

        token = this.tokenizer.get();

        while (this.isOperator(context, token)) {
            let name: string;
            let symbol: string = token.s;
            let precedence: Precedence;
            let leftAssociative: boolean = true;

            switch (token.s) {
                case "+":
                    name = "add";
                    precedence = Precedence.Addition;
                    break;

                case "-":
                    name = "subtract";
                    precedence = Precedence.Addition;
                    break;

                case "*":
                    name = "multiply";
                    precedence = Precedence.Multiplication;
                    break;

                case "/":
                    name = "divide";
                    precedence = Precedence.Multiplication;
                    break;

                case "^":
                    name = "power";
                    precedence = Precedence.Power;
                    leftAssociative = false;
                    break;

                case "mod":
                    name = "modulo";
                    precedence = Precedence.Multiplication;
                    break;

                default:
                    throw new Error(Utils.formatError(token.line, token.column, `Unsupported operation: ${token.s}`));
            }

            if (precedence < minimumPrecedence) {
                break;
            }

            if ((precedence == minimumPrecedence) && (leftAssociative)) {
                break;
            }

            this.tokenizer.nextExpressionToken();

            expression = new Commands.BinaryOperation(token.line, token.column, name, symbol, expression, this.parseStatement(context, precedence, null));

            token = this.tokenizer.get();
        }

        return expression;
    }

    isExpressionChain(context: Context, token: Token): boolean {
        return this.isExpression(context, token);
    }

    /**
     *  ExpressionChain = Expression { Expression }. 
     */
    private parseExpressionChain(context: Context): Command {
        let startToken = this.tokenizer.get();

        if (!this.isExpressionChain(context, startToken)) {
            throw new Error(Utils.formatError(startToken.line, startToken.column, `Expected expression chain, but found: ${startToken.s}`));
        }

        // parse: SingleExpression
        let expression = this.parseExpression(context);
        let token = this.tokenizer.get();

        if (this.isExpression(context, token)) {
            let expressions: Command[] = [expression];

            while (this.isExpression(context, token)) {
                expressions.push(this.parseExpression(context));

                token = this.tokenizer.get();
            }

            expression = new Commands.Chain(startToken.line, startToken.column, expressions);
        }

        return expression;
    }

    isExpression(context: Context, token: Token): boolean {
        return (this.isTuple(context, token)) || (this.isList(context, token)) || (this.isMap(context, token)) || (this.isConstant(context, token)) ||
            (this.isCall(context, token)) || (this.isAccess(context, token)) || (this.isUnit(context, token));
    }

    /**
     *  Expression = Tuple | List | Map | Constant | Call | Access | Unit | Identifier. 
     */
    private parseExpression(context: Context, leadingUnit?: Unit): Command {
        let token = this.tokenizer.get();

        if (!this.isExpression(context, token)) {
            throw new Error(Utils.formatError(token.line, token.column, `Expected expression, but found: ${token.s}`));
        }

        let result: Command;

        if (this.isTuple(context, token)) {
            result = this.parseTuple(context);
        }
        else if (this.isList(context, token)) {
            result = this.parseList(context);
        }
        else if (this.isMap(context, token)) {
            result = this.parseMap(context);
        }
        else if (this.isConstant(context, token)) {
            result = this.parseConstant(context);
        }
        else if (this.isCall(context, token)) {
            result = this.parseCall(context);
        }
        else if (this.isAccess(context, token)) {
            result = this.parseAccess(context);
        }
        else if (this.isUnit(context, token)) {
            result = this.parseUnit(context);
        }
        else {
            throw new Error(Utils.formatError(token.line, token.column, `Implementation missing for expression: ${token.s}`));
        }

        return result;
    }

    /**
     * Tuple = "(" [ Statement { "," Statement } ] ")";
     */
    private parseTuple(context: Context): Command {
        let startToken = this.tokenizer.get();
        let commands: Command[] = [];

        if (!this.isTuple(context, startToken)) {
            throw new Error(Utils.formatError(startToken.line, startToken.column, `Expected tuple, but found: ${startToken.s}`));
        }

        let token = this.tokenizer.nextExpressionToken();

        while (true) {
            if (!this.isStatement(context, token)) {
                break;
            }

            commands.push(this.parseStatement(context));

            token = this.tokenizer.get();

            if (!this.isSeparator(context, token, ",")) {
                break;
            }

            token = this.tokenizer.nextExpressionToken();
        }

        if (!this.isClosingParentheses(context, token)) {
            throw new Error(Utils.formatError(token.line, token.column, `Expected end of tuple, but found: ${token.s}`));
        }

        this.tokenizer.nextExpressionToken();

        return new Commands.ATuple(startToken.line, startToken.column, commands);
    }

    /**
     * List = "[" [ Statement { "," Statement } ] "]";
     */
    private parseList(context: Context): Command {
        let startToken = this.tokenizer.get();
        let commands: Command[] = [];

        if (!this.isList(context, startToken)) {
            throw new Error(Utils.formatError(startToken.line, startToken.column, `Expected list, but found: ${startToken.s}`));
        }

        let token = this.tokenizer.nextExpressionToken();

        while (true) {
            if (!this.isStatement(context, token)) {
                break;
            }

            commands.push(this.parseStatement(context));

            token = this.tokenizer.get();

            if (!this.isSeparator(context, token, ",")) {
                break;
            }

            token = this.tokenizer.nextExpressionToken();
        }

        if (!this.isClosingList(context, token)) {
            throw new Error(Utils.formatError(token.line, token.column, `Expected end of list, but found: ${token.s}`));
        }

        this.tokenizer.nextExpressionToken();

        return new Commands.AList(startToken.line, startToken.column, commands);
    }

    /**
     * Map = "{" Key ":" Statement { "," Key ":" Statement } "}";
     */
    private parseMap(context: Context): Command {
        let startToken = this.tokenizer.get();
        let commands: {
            key: Command;
            value: Command;
        }[] = [];

        if (!this.isMap(context, startToken)) {
            throw new Error(Utils.formatError(startToken.line, startToken.column, `Expected map, but found: ${startToken.s}`));
        }

        let token = this.tokenizer.nextExpressionToken();

        while (true) {
            if (!this.isKey(context, token)) {
                break;
            }

            let key = this.parseKey(context);

            token = this.tokenizer.get();

            if (!this.isSeparator(context, token, ":")) {
                throw new Error(Utils.formatError(token.line, token.column, `Expected ":", but found: ${token.s}`));
            }

            token = this.tokenizer.nextExpressionToken();

            let value = this.parseStatement(context);

            commands.push({
                key: key,
                value: value
            });

            token = this.tokenizer.get();

            if (!this.isSeparator(context, token, ",")) {
                break;
            }

            token = this.tokenizer.nextExpressionToken();

        }

        if (!this.isClosingMap(context, token)) {
            throw new Error(Utils.formatError(token.line, token.column, `Expected end of map, but found: ${token.s}`));
        }

        this.tokenizer.nextExpressionToken();

        return new Commands.AMap(startToken.line, startToken.column, commands);
    }

    /**
     * Key = String | Identifier. 
     */
    parseKey(context: Context): Command {
        let token = this.tokenizer.get();

        if (!this.isKey(context, token)) {
            throw new Error(Utils.formatError(token.line, token.column, `Expected key, but found: ${token.s}`));
        }

        if (this.isString(context, token)) {
            return this.parseString(context);
        }

        if (this.isIdentifier(context, token)) {
            return this.parseIdentifier(context);
        }

        throw new Error(Utils.formatError(token.line, token.column, `Implementation missing for key: ${token.s}`));
    }

    /**
     * Constant = Number | String. 
     */
    parseConstant(context: Context): Command {
        let token = this.tokenizer.get();

        if (!this.isConstant(context, token)) {
            throw new Error(Utils.formatError(token.line, token.column, `Expected constant, but found: ${token.s}`));
        }

        if (this.isNumber(context, token)) {
            return this.parseNumber(context);
        }

        if (this.isString(context, token)) {
            return this.parseString(context);
        }

        throw new Error(Utils.formatError(token.line, token.column, `Implementation missing for constant: ${token.s}`));
    }

    /**
     * Number = number.
     */
    private parseNumber(context: Context): Commands.AValue {
        let token = this.tokenizer.get();

        if (!this.isNumber(context, token)) {
            throw new Error(Utils.formatError(token.line, token.column, `Expected number, but found: ${token.s}`));
        }

        this.tokenizer.nextExpressionToken();

        return new Commands.AValue(token.line, token.column, new Quantity(token.n));
    }

    /**
     * String = delimiter { string | reference | ( "${" Expression "}") } delimiter. 
     */
    private parseString(context: Context): Commands.StringChain {
        let startToken = this.tokenizer.get();

        if (!this.isString(context, startToken)) {
            throw new Error(Utils.formatError(startToken.line, startToken.column, `Expected delimiter, but found: ${startToken.s}`));
        }

        let expressions: Command[] = [];
        let token = this.tokenizer.nextStringToken();

        while (true) {
            if (this.isEnd(context, token)) {
                throw new Error(Utils.formatError(startToken.line, startToken.column, "Unclosed string"));
            }

            if (token.type === "delimiter") {
                token = this.tokenizer.nextExpressionToken();

                break;
            }

            if (token.type === "string") {
                expressions.push(new Commands.StringStringSegment(token.line, token.column, token.s));

                token = this.tokenizer.nextStringToken();

                continue;
            }

            if (token.type === "reference") {
                let name = token.s;

                expressions.push(new Commands.StringReferenceSegment(token.line, token.column, name))

                token = this.tokenizer.nextStringToken();

                continue;
            }

            if (this.isOpeningPlaceholder(context, token)) {
                let blockToken = this.tokenizer.nextExpressionToken();

                if (this.isEnd(context, blockToken)) {
                    throw new Error(Utils.formatError(token.line, token.column, "Unclosed block"));
                }

                expressions.push(new Commands.StringPlaceholderSegment(token.line, token.column, this.parseStatement(context)));

                token = this.tokenizer.get();

                if (!this.isClosingPlaceholder(context, token)) {
                    throw new Error(Utils.formatError(token.line, token.column, `Expected closing placeholder, but found: ${token.s}`));
                }

                token = this.tokenizer.nextStringToken();

                continue;
            }

            throw new Error(Utils.formatError(token.line, token.column, `Expected string content, but found: ${token.s}`));
        }

        return new Commands.StringChain(startToken.line, startToken.column, expressions);
    }

    /**
     * Call = word Statement.
     */
    private parseCall(context: Context): Command {
        let startToken = this.tokenizer.get();

        if (!this.isCall(context, startToken)) {
            throw new Error(Utils.formatError(startToken.line, startToken.column, `Expected call, but found: ${startToken.s}`));
        }

        let procedure = context.requiredAsProcedure(startToken.s);

        this.tokenizer.nextExpressionToken();

        let args = this.parseStatement(context);


        return new Commands.Call(startToken.line, startToken.column, procedure, args);
    }

    /**
     * Access = word.
     */
    private parseAccess(context: Context): Command {
        let startToken = this.tokenizer.get();

        if (!this.isAccess(context, startToken)) {
            throw new Error(Utils.formatError(startToken.line, startToken.column, `Expected access, but found: ${startToken.s}`));
        }

        let variable = context.get(startToken.s);

        this.tokenizer.nextExpressionToken();

        return new Commands.Access(startToken.line, startToken.column, variable.name);
    }

    /**
     * Unit = unit { [ "/" ] unit }.
     */
    private parseUnit(context: Context): Command {
        let startToken = this.tokenizer.get();

        if (!this.isUnit(context, startToken)) {
            throw new Error(Utils.formatError(startToken.line, startToken.column, `Expected unit, but found: ${startToken.s}`));
        }

        let unitString = startToken.s;
        let token = this.tokenizer.nextExpressionToken();

        while (true) {
            if ((this.isOperator(context, token, "/")) && (this.isUnit(context, this.tokenizer.lookAheadExpressionToken()))) {
                token = this.tokenizer.nextExpressionToken();

                unitString += "/" + token.s;

                token = this.tokenizer.nextExpressionToken();

                continue;
            }

            if (this.isUnit(context, token)) {
                unitString += " " + token.s;

                token = this.tokenizer.nextExpressionToken();

                continue;
            }

            break;
        }

        let unit = Units.get(unitString);

        if (!unit) {
            throw new Error(Utils.formatError(startToken.line, startToken.column, `Unit not defined: ${unitString}`));
        }

        return new Commands.AUnit(startToken.line, startToken.column, unit);
    }

    /**
     * Identifier = identifier.
     */
    parseIdentifier(context: Context): Command {
        let token = this.tokenizer.get();

        if (!this.isIdentifier(context, token)) {
            throw new Error(Utils.formatError(token.line, token.column, `Expected identifier, but found: ${token.s}`));
        }

        return new Commands.AValue(token.line, token.column, new Identifier(token.s));
    }

    isUnaryOperator(context: Context, token: Token): boolean {
        if (!this.isOperator(context, token)) {
            return false;
        }

        return (token.s === "+") || (token.s === "-");
    }

    isOperator(context: Context, token: Token, operator?: string): boolean {
        if (token.type === "operator") {
            return (!operator) || (operator === token.s);
        }

        return false;
    }

    isOpeningParentheses(context: Context, token: Token) {
        return this.isBrackets(context, token, "(");
    }

    isClosingParentheses(context: Context, token: Token) {
        return this.isBrackets(context, token, ")");
    }

    isOpeningList(context: Context, token: Token) {
        return this.isBrackets(context, token, "[");
    }

    isClosingList(context: Context, token: Token) {
        return this.isBrackets(context, token, "]");
    }

    isOpeningMap(context: Context, token: Token) {
        return this.isBrackets(context, token, "{");
    }

    isClosingMap(context: Context, token: Token) {
        return this.isBrackets(context, token, "}");
    }

    isOpeningPlaceholder(context: Context, token: Token) {
        return this.isBrackets(context, token, "${");
    }

    isClosingPlaceholder(context: Context, token: Token) {
        return this.isBrackets(context, token, "}");
    }

    isBrackets(context: Context, token: Token, brackets?: string): boolean {
        return (token.type === "brackets") && ((!brackets) || (brackets === token.s));
    }

    isIdentifier(context: Context, token: Token): boolean {
        if (token.type !== "word") {
            return false;
        }

        return Utils.isIdentifier(token.s);
    }

    isTuple(context: Context, token: Token): boolean {
        return this.isOpeningParentheses(context, token);
    }

    isList(context: Context, token: Token): boolean {
        return this.isOpeningList(context, token);
    }

    isMap(context: Context, token: Token): boolean {
        return this.isOpeningMap(context, token);
    }

    isKey(context: Context, token: Token): boolean {
        return (this.isIdentifier(context, token)) || (this.isString(context, token));
    }

    isConstant(context: Context, token: Token): boolean {
        return this.isNumber(context, token) || this.isString(context, token);
    }

    isNumber(context: Context, token: Token): boolean {
        return token.type === "number";
    }

    isString(context: Context, token: Token): boolean {
        return token.type === "delimiter";
    }

    isCall(context: Context, token: Token): boolean {
        if (token.type !== "word") {
            return false;
        }

        return context.isProcedure(token.s);
    }

    isAccess(context: Context, token: Token): boolean {
        if (token.type !== "word") {
            return false;
        }

        return context.isVariable(token.s);
    }

    isUnit(context: Context, token: Token): boolean {
        if ((token.type !== "word") && (token.type !== "delimiter") && (token.type !== "separator") && (token.type !== "operator")) {
            return false;
        }

        return Units.exists(token.s);
    }

    isEnd(context: Context, token: Token): boolean {
        return token.type === "end";
    }

    isSeparator(context: Context, token: Token, separator?: string): boolean {
        return (token.type === "separator") && ((!separator) || (separator === token.s));
    }

}