function round3(value) {

    return Math.round(
        (Number(value || 0) + Number.EPSILON) *
        1000
    ) / 1000;
}

function getAnnotationCentre(
    annotation
) {

    const x =
        Number(
            annotation.x || 0
        );

    const y =
        Number(
            annotation.y || 0
        );

    const width =
        Number(
            annotation.width || 0
        );

    const height =
        Number(
            annotation.height || 0
        );

    return {

        x:
            x +
            width / 2,

        y:
            y +
            height / 2
    };
}

function findSpanLabel(
    coordinate,
    axes = []
) {

    if (
        !Array.isArray(axes) ||
        axes.length === 0
    ) {

        return "";
    }

    if (
        axes.length === 1
    ) {

        return axes[0].label;
    }

    for (
        let index = 0;
        index <
        axes.length - 1;
        index++
    ) {

        const current =
            axes[index];

        const next =
            axes[index + 1];

        if (

            coordinate >=
                current.position &&

            coordinate <=
                next.position

        ) {

            const midpoint =

                (
                    current.position +
                    next.position
                ) / 2;

            const snapTolerance =

                Math.abs(
                    next.position -
                    current.position
                ) * 0.15;

            if (

                Math.abs(
                    coordinate -
                    current.position
                ) <=
                snapTolerance

            ) {

                return current.label;
            }

            if (

                Math.abs(
                    coordinate -
                    next.position
                ) <=
                snapTolerance

            ) {

                return next.label;
            }

            return (

                current.label +
                "-" +
                next.label
            );
        }
    }

    if (

        coordinate <
        axes[0].position

    ) {

        return axes[0].label;
    }

    return axes[
        axes.length - 1
    ].label;
}

function locateGrid(
    annotation,
    pageGridModel
) {

    if (
        !pageGridModel
    ) {

        return "";
    }

    if (
        !pageGridModel.alphaAxis
    ) {

        return "";
    }

    const centre =
        getAnnotationCentre(
            annotation
        );

    //----------------------------------
    // ALPHA GRID
    //----------------------------------

    let alphaLocation =
        "";

    const alphaAxis =
        pageGridModel.alphaAxis;

    if (

        alphaAxis.orientation ===
        "horizontal"

    ) {

        alphaLocation =
            findSpanLabel(

                centre.x,

                alphaAxis.axes
            );
    }

    else {

        alphaLocation =
            findSpanLabel(

                centre.y,

                alphaAxis.axes
            );
    }

    //----------------------------------
    // NUMERIC GRID
    //----------------------------------

    let numericLocation =
        "";

    const numericAxis =
        pageGridModel.numericAxis;

    if (
        numericAxis
    ) {

        if (

            numericAxis.orientation ===
            "horizontal"

        ) {

            numericLocation =
                findSpanLabel(

                    centre.x,

                    numericAxis.axes
                );
        }

        else {

            numericLocation =
                findSpanLabel(

                    centre.y,

                    numericAxis.axes
                );
        }
    }

    //----------------------------------
    // FINAL GRID
    //----------------------------------

    if (

        !alphaLocation &&
        !numericLocation

    ) {

        return "";
    }

    if (

        alphaLocation &&
        numericLocation

    ) {

        return (

            alphaLocation +
            numericLocation
        );
    }

    if (alphaLocation) {

        return alphaLocation;
    }

    return numericLocation;
}

module.exports = {

    locateGrid,

    getAnnotationCentre,

    findSpanLabel
};