
# (Really) Simple Text Editor

JavaScript command-line text editor. No dependencies.

Based on Gary Bernhardt's [stream](https://www.twitch.tv/gary_bernhardt/v/90796516).

Commands:

| **Command** | **Description**
|------------:|-----------------
| `^B`        | Backward
| `^F`        | Forward
| `^N`        | Next Line
| `^P`        | Prev Line
| `^A`        | Start of Line
| `^E`        | End of Line
| `^C`        | Exit
| `^S`        | Save (only when a file is loaded)

Start (new file):

```bash
$ node editor.js
```

Start (load file):

```bash
$ node editor.js path/to/file
```
