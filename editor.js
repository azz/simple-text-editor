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
        return this.splice(row, 1, line.substring(0, col) + sequence + line.substring(col))
    }
    delete(row, col, count=1) {
        const line = this.line(row)
        return this.splice(row, 1, line.substring(0, col) + line.substring(col + count))
    }
    joinRows(firstRow) {
        return this.splice(firstRow, 2, this.line(firstRow) + this.line(firstRow + 1))
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

const csi = (...args) => `${Ctrl.ESC}[${String.raw(...args)}`
const Ansi = {
    eraseDisplay: csi`2J`,
    cursorUp: csi`1A`,
    cursorDown: csi`1B`,
    cursorForward: csi`1C`,
    cursorBack: csi`1D`,
    cursorPosition: (row=0, col=0) => csi`${row+1};${col+1}H`,
}

if (require.main === module) {
    const {stdin, argv} = process
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

    [Ctrl.A]: ({ buffer, cursor }) =>
        State(buffer, cursor.atCol(0)),
    [Ctrl.E]: ({ buffer, cursor }) =>
        State(buffer, cursor.atCol(buffer.line(cursor.row).length)),

    [Ctrl.F]: ({ buffer, cursor }) => State(buffer, cursor.right),
    [Ctrl.B]: ({ buffer, cursor }) => State(buffer, cursor.left),

    [Ctrl.N]: ({ buffer, cursor }) => State(buffer, cursor.down),
    [Ctrl.P]: ({ buffer, cursor }) => State(buffer, cursor.up),

    [Ctrl.H]: ({ buffer, cursor }) => {
        if (cursor.col === 0 && cursor.row > 0) {
            const prevLineLength = buffer.line(cursor.row - 1).length
            return State(buffer.joinRows(cursor.row - 1), cursor.up.atCol(prevLineLength))
        } else {
            return State(buffer.delete(cursor.row, cursor.col - 1), cursor.left)
        }
    },

    [Ctrl.M]: ({ buffer, cursor }) =>
        State(buffer.newline(cursor.row, cursor.col), cursor.down.atCol(0)),
}

if (process.argv.length > 2)
    ops[Ctrl.S] = ({ buffer, cursor }) => {
        Buffer.persist(buffer, process.argv[2])
        return State(buffer, cursor)
    }

function reduce({ buffer, cursor }, char) {
    let next
    if (char in ops)
        return ops[char]({ buffer, cursor }, char)
    if (/[\x00-\x1F]/.test(char))
        return State(
            buffer.insert(cursor.row, cursor.col, name(char)),
            cursor.right.right
        )
    return State(buffer.insert(cursor.row, cursor.col, char), cursor.right)
}

function name(char) {
    return '^' + String.fromCharCode('A'.charCodeAt(0) -1 + char.charCodeAt(0))
}

function clamp({ buffer, cursor }) {
    return State(buffer, new Cursor(
        Math.max(0, Math.min(cursor.row, buffer.length - 1)),
        Math.max(0, Math.min(cursor.col, buffer.line(cursor.row).length))
    ))
}

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
