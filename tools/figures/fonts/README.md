# Fonts of the figures

Two open-licensed faces, both under the SIL Open Font License 1.1 (embedding and redistribution are allowed):

- Source Serif 4 (Adobe): regular, italic, semibold and bold. The body face of the Dossier style.
- JetBrains Mono (JetBrains): regular and bold. The face of identifiers and tile values.

`style.py` registers these files. If a file is missing, the figure uses DejaVu Serif or DejaVu Sans Mono and a warning says so.
Roboto Condensed (the structure face of the site) is not bundled: no figure text uses it.

Licence texts: `OFL-SourceSerif4.txt` (Source Serif 4, Adobe, from the upstream repository `adobe-fonts/source-serif`) and `OFL-JetBrainsMono.txt` (JetBrains Mono, from `JetBrains/JetBrainsMono`). Each text and copyright line stays with the font files.
JetBrains Mono has no semibold file: a semibold request uses the bold file.
