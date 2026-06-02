# Tree Layout

Colonnes : A=x0 · B=x50 · C=x100 · D=x156(spine) · E=x212 · F=x262 · G=x312
Chaque rangée = 52px de hauteur. Déplace les cellules, laisse `.` pour vide.

| Row | A·OBS | B·TRACE | C·TRAFFIC | D·CENTER | E·MR   | F·PROC  | G·MKT |
|-----|-------|---------|-----------|----------|--------|---------|-------|
|  0  |       |    .    |     .     |   Large  |   .    |    .    |   .   |
|  1  |       |         |     .     |  Medium  |   .    |    P4   |   .   |
|  2  |   .   |         |     .     |  SMall   |   .    |    .    |   .   |
|  3  |   .   |    .    |     .     |    .     |   .    |   P3    |   .   |
|  4  | ProcM |    .    |     Mem+  |   Nano   |   .    |         |   .   |
|  5  |  Monit| Chart   |  RAM      |  Start   |   .    |   P2    |   .   |
|  6  |   .   |Tracin   |  .        |    T1    |        |         |   .   |
|  7  |   I   |         |           |          |   T2   |    T3   |   T4  |
|  8  |  II   |         |   Mixed   |          |   T7   |    T6   |    T5 |
|  9  |III    |    .    |     .     |FIBERS    |   T8   |   T9    | T10   |
| 10  |  IV   |    .    |    PDF    |          |        |    T12  |  T11  |
| 11  |       |    .    |     .     |          |        |    .    |       |
| 12  |   V   |    .    |     .     |    .     |        |    .    |   .   |
