
# (Really) Simple Text Editor

JavaScript command-line text editor. No dependencies.

Based on Gary Bernhardt's [stream](https://www.twitch.tv/gary_bernhardt/v/90796516).

## Install

```bash
$ npm i -g simple-text-editor
```

## Start

Start (new file):

```bash
$ simple-text-editor
```

Start (load file):

```bash
$ simple-text-editor path/to/file
```

## Commands

| **Command** | **Description**
|------------:|-----------------
| `^B` or `←` | Backward
| `^F` or `→` | Forward
| `^N` or `↓` | Next Line
| `^P` or `↑` | Prev Line
| `^A`        | Start of Line
| `^E`        | End of Line
| `^C`        | Exit
| `^S`        | Save (only when a file is loaded)
