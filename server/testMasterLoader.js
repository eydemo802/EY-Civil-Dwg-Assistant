const {
    loadShapeMaster
} = require("./config/excelMasterLoader");

const master =
    loadShapeMaster();

console.log(
    "Shapes Loaded:",
    Object.keys(master.shapes).length
);

console.log(
    "Aliases Loaded:",
    Object.keys(master.shapeAliases).length
);

console.log(
    "Dimension Aliases:",
    Object.keys(master.dimensionAliases).length
);