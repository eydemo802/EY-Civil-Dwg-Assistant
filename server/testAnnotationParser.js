const {
    parseAnnotation
} = require("./parser/annotationParser");

const result = parseAnnotation(
    "Solid Cylinder - Raft - Dia 28000 x Depth 3500"
);

console.log(
    JSON.stringify(result, null, 4)
);