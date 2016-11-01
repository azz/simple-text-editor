#!/usr/bin/env node

const fs = require('fs')

function State(buffer, cursor) { return { buffer, cursor } }
State.blank = () => State(Buffer.of(''), Cursor.origin())

class Buffer extends Array {
    static load(filePath) {
        const content = fs.readFileSync(filePath).toString()
        return Buffer.from(content.split('\n'))
    }
    static persist(buffer, filePath) {
        fs.writeFileSync(filePath, buffer.join('\n'))
    }

    insert(row, col, sequence) {
        const line = this.line(row)
        const newLine = line.substring(0, col) + sequence + line.substring(col)
        return this.splice(row, 1, newLine)
    }
    delete(row, col, count=1) {
        const line = this.line(row)
        return this.splice(row, 1, line.slice(0, col) + line.slice(col + count))
    }
    joinRows(firstRow) {
        const newLine = this.line(firstRow) + this.line(firstRow + 1)
        return this.splice(firstRow, 2, newLine)
    }
    newline(row, col) {
        const line = this.line(row)
        return this.splice(row, 1, line.substring(0, col), line.substring(col))
    }
    line(row) {
        return this[row] || ''
    }

    // Evil override of splice to dupe before splicing
    splice(...args) {
        const next = Buffer.from(this);
        [].splice.apply(next, args)
        return next
    }
}

class Cursor {
    constructor (row, col) { this.row = row; this.col = col }
    static origin() { return new Cursor(0, 0) }

    get down() { return new Cursor(this.row + 1, this.col) }
    get up() { return new Cursor(this.row - 1, this.col) }
    get left() { return new Cursor(this.row, this.col - 1) }
    get right() { return new Cursor(this.row, this.col + 1) }

    atCol(col) { return new Cursor(this.row, col) }
    atRow(row) { return new Cursor(row, this.col) }
}

const Ctrl = {
    A: '\u0001', // Start of Line
    B: '\u0002', // Backward
    C: '\u0003', // Kill
    E: '\u0005', // End of Line
    F: '\u0006', // Forward
    H: '\u0008', // Backspace
    M: '\u000D', // New Line
    N: '\u000E', // Next line
    P: '\u0010', // Prev Line
    S: '\u0013', // Save

    ESC: '\u001B', // Escape
}

// Control Sequence Introducers!
const csi = (...args) => `${Ctrl.ESC}[${String.raw(...args)}`
const Ansi = {
    eraseDisplay: csi`2J`,
    cursorUp: csi`A`,
    cursorDown: csi`B`,
    cursorForward: csi`C`,
    cursorBack: csi`D`,
    cursorPosition: (row=0, col=0) => csi`${row+1};${col+1}H`,
}

if (require.main === module) {
    const {stdin, argv} = process
    // This will likely not work on non-TTYs such as Cygwin.
    stdin.setRawMode(true)
    stdin.setEncoding('utf8')
    stdin.resume()
    let state = argv.length <= 2
        ? State.blank()
        : State(Buffer.load(argv[2]), Cursor.origin())
    render(state)
    stdin.on('data', char => {
        state = clamp(reduce(state, char))
        render(state)
    })
}

const ops = {
    [Ctrl.C]: () => {
        process.stdout.write(Ansi.eraseDisplay)
        process.exit(0)
    },

    [Ctrl.A]: ({ buffer, cursor }) => State(buffer, cursor.atCol(0)),
    [Ctrl.E]: ({ buffer, cursor }) => State(
        buffer, cursor.atCol(buffer.line(cursor.row).length)
    ),

    [Ctrl.F]: ({ buffer, cursor }) => State(buffer, cursor.right),
    [Ctrl.B]: ({ buffer, cursor }) => State(buffer, cursor.left),
    [Ctrl.N]: ({ buffer, cursor }) => State(buffer, cursor.down),
    [Ctrl.P]: ({ buffer, cursor }) => State(buffer, cursor.up),

    [Ctrl.H]: ({ buffer, cursor }) => {
        if (cursor.col === 0 && cursor.row > 0) {
            const prevLineLength = buffer.line(cursor.row - 1).length
            return State(
                buffer.joinRows(cursor.row - 1),
                cursor.up.atCol(prevLineLength)
            )
        }
        return State(buffer.delete(cursor.row, cursor.col - 1), cursor.left)
    },
    [Ctrl.M]: ({ buffer, cursor }) => State(
        buffer.newline(cursor.row, cursor.col), cursor.down.atCol(0)
    ),
}

if (process.argv.length > 2)
    ops[Ctrl.S] = ({ buffer, cursor }) => {
        Buffer.persist(buffer, process.argv[2])
        return State(buffer, cursor)
    }

const aliases = [
    [Ansi.cursorBack, Ctrl.B],
    [Ansi.cursorForward, Ctrl.F],
    [Ansi.cursorDown, Ctrl.N],
    [Ansi.cursorUp, Ctrl.P],
]

for (const [alias, actual] of aliases) {
    ops[alias] = ops[actual]
}

/** (state, char) -> state */
function reduce({ buffer, cursor }, char) {
    if (char in ops) // Operator
        return ops[char]({ buffer, cursor }, char)
    if (/[\x00-\x1F]/.test(char)) // Non-printable character
        return State(
            buffer.insert(cursor.row, cursor.col, name(char)),
            cursor.right.right
        )
    // Printable character
    return State(buffer.insert(cursor.row, cursor.col, char), cursor.right)
}

/** Render an unsupported control code, such as control-D, as '^D' */
function name(char) {
    return '^' + String.fromCharCode('A'.charCodeAt(0) - 1 + char.charCodeAt(0))
}

/** Ensure that the cursor does not fall outside of the buffer */
function clamp({ buffer, cursor }) {
    return State(buffer, new Cursor(
        Math.max(0, Math.min(cursor.row, buffer.length - 1)),
        Math.max(0, Math.min(cursor.col, buffer.line(cursor.row).length))
    ))
}

/**
 * Render current state to process.stdout as a TTY.
 * Currently all state changes cause an entire re-render.
 * There are heaps of ways this could be optimized.
 */
function render({ buffer, cursor }) {
    const {stdout} = process
    stdout.write(Ansi.eraseDisplay)
    stdout.write(Ansi.cursorPosition(0, 0))
    buffer.forEach((line, rowIndex) => {
        stdout.write(Ansi.cursorPosition(rowIndex))
        stdout.write(line)
    })
    stdout.write(Ansi.cursorPosition(cursor.row, cursor.col))
}
