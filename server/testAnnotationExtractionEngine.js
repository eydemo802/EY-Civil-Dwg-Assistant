const {
    extractAnnotations
} = require(
    "./parser/annotationExtractionEngine"
);

const sampleTextItems = [

    {
        text:
            "Solid Cylinder - Raft - Dia 28000 x Depth 3500",

        page: 1,
        x: 250,
        y: 400
    },

    {
        text:
            "Random Drawing Note",

        page: 1,
        x: 100,
        y: 100
    },

    {
        text:
            "Cuboid - Pedestal - Length 5000 x Width 3000 x Height 2000",

        page: 1,
        x: 500,
        y: 600
    }
];

console.log(
    JSON.stringify(
        extractAnnotations(
            sampleTextItems
        ),
        null,
        4
    )
);