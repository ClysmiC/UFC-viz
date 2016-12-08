// TODO:
// - Knockout - submission - decision labels near chart that highlight similar to weight labels

// var isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);

// if(!isChrome) {
//     alert("This site was designed and tested on Google Chrome. Extreme slowdown has been noticed on Firefox. Performance on Edge and IE is acceptable, however for best experience please use Google Chrome");
// }

// master list of fighters
// dict indexed by fighter id
var fighters = {};

// master list of matchups
// list of objects that look like { source: [fighterObj], target: [fighterObj], count: [number] }
var matchups = [];

// Master list of weight classes.
// After parsing data, any class that has 0 fighters in it gets removed
// from this list.
var weightClasses = ["Atomweight", "Strawweight", "Flyweight",
                     "Bantamweight", "Featherweight", "Lightweight",
                     "Welterweight", "Middleweight", "Light Heavyweight",
                     "Heavyweight", "Super Heavyweight"];

// Dict indexed by weight class that returns true if selected,
// false if not -- will be set true when graph gets created if
// that class has > 0 fighters. Then, the user can toggle
// by clicking on the labels
var selectedWeightClasses = {}
selectedWeightClasses["Atomweight"] = true;
selectedWeightClasses["Strawweight"] = true;
selectedWeightClasses["Flyweight"] = true;
selectedWeightClasses["Bantamweight"] = true;
selectedWeightClasses["Featherweight"] = true;
selectedWeightClasses["Lightweight"] = true;
selectedWeightClasses["Welterweight"] = true;
selectedWeightClasses["Middleweight"] = true;
selectedWeightClasses["Light Heavyweight"] = true;
selectedWeightClasses["Heavyweight"] = true;
selectedWeightClasses["Super Heavyweight"] = true;

var weightDescriptions = {};
weightDescriptions["Atomweight"] = "<105 lb (women only)";
weightDescriptions["Strawweight"] = "<115 lb";
weightDescriptions["Flyweight"] = "115-125 lb";
weightDescriptions["Bantamweight"] = "125-135 lb";
weightDescriptions["Featherweight"] = "135-145 lb";
weightDescriptions["Lightweight"] = "145-155 lb";
weightDescriptions["Welterweight"] = "155-170 lb";
weightDescriptions["Middleweight"] = "170-185 lb";
weightDescriptions["Light Heavyweight"] = "185-205 lb";
weightDescriptions["Heavyweight"] = "205-265 lb";
weightDescriptions["Super Heavyweight"] = ">265 lb";

var createInfoViz; // function

// fighters with less than this number of fights aren't shown on the network
var minFightCount = 10;

// svg dimensions
var width = window.innerWidth - 100
var header = document.getElementById("header");
var height = window.innerHeight - 75 - header.offsetHeight;

var d3nodes;
var d3links;
var d3simulation;

var tooltip;
var smallTooltip;
var svg;

var visibleFighters;

// space allocated at top of svg exclusively for the labels
var labelMargin = 80;

var defaultLinkOpacity = 0.4;
var defaultLinkStroke = "#999999";

var tooltipFocusId = "";
var selectedFighterId = "";

var selectedTranslateX = 0;
var selectedTranslateY = 0;
var selectedScale = 1;

var fightRadius = 6;
var fightStrokeWidth = 3;

var nodeStrokeWidth = 2.5;

// Gets X position for the cluster or label of a given weight class
// weightClass - class being queried
// weightClassList - ordered list of weight classes being considered.
//                   for label X's this should be all of them, but when
//                   the network is filtered by weight class only consider
//                   the list of filtered classes
function getXForWeightClass(weightClass, weightClassList) {
    if(weightClassList == null) {
        weightClassList = weightClasses;
    }
    
    var i = weightClassList.indexOf(weightClass);

    if(i === -1) return -1;

    var margin = 50;
    
    return margin + (width - 2 * margin) / weightClassList.length * (i + .5);
}

function getSelectedWeightClasses() {
    selection = [];

    for(var wClass in selectedWeightClasses) {
        if (selectedWeightClasses[wClass]) {
            selection.push(wClass);
        }
    }

    return selection;
}

function getTooltipHTMLForFighter(id, omitName) {
    var fighter = fighters[id];
    var htmlString = "";

    if(!omitName) {
        htmlString += "<b>" + fighter.name + "</b>";
        htmlString += "<hr>";
    }
    htmlString += fighter.wClass;
    htmlString += "<br>";
    htmlString += inchesToHeightStr(fighter.height) + " " + fighter.weight + " lbs";
    htmlString += "<br>";
    htmlString += fighter.wins + " - " + fighter.losses + " - " + fighter.draws;
    htmlString += "<br>";
    htmlString += "Win %: " + (fighter.winPercent * 100).toFixed(2);

    return htmlString;
}

function getSvgCircleForFighter(id) {
    var circle = d3.select("#node" + id);
    
    if(circle.empty()) {
        return null;
    }

    return circle;
}

function getSvgLabelForFighter(id) {
    var label = d3.select("#label" + id);
    
    if(label.empty()) {
        return null;
    }

    return label;
}

// Used to clamp nodes/labels, etc. to within their appropriate limits.
// Factors in translation, zoom, selection, etc.
function clampX(value) {
    var minimum = 50;
    var maximum = width - 50;

    if(selectedFighterId !== "") {
        var selectedCircle = getSvgCircleForFighter(selectedFighterId);
        var selectedX = parseFloat(selectedCircle.attr("cx"));
        minimum = selectedX - (width / 4) / selectedScale;
        maximum = selectedX + (width / 4) / selectedScale;
        
        minimum += 75 / selectedScale;
        // maximum += 50 / selectedScale;
    }

    return Math.min(Math.max(value, minimum), maximum);
    
}
function clampY(value) {
    var minimum = labelMargin;
    var maximum = height - 20 / selectedScale;

    if(selectedFighterId !== "") {
        var selectedCircle = getSvgCircleForFighter(selectedFighterId);
        var selectedY = parseFloat(selectedCircle.attr("cy"));
        minimum = selectedY - (height / 2 - labelMargin) / selectedScale;
        maximum = selectedY + (height / 2) / selectedScale;

        minimum += 50 / selectedScale;
        maximum += 50 / selectedScale;
    }

    return Math.min(Math.max(value, minimum), maximum);
}

function centerOn(id) {
    var x = getSvgCircleForFighter(id).attr("cx");
    var y = getSvgCircleForFighter(id).attr("cy");

    var targetScale = 1.5;
    var targetX = width / 4;
    var targetY = height / 2;

    var deltaX = targetX - x * targetScale;
    var deltaY = targetY - y * targetScale;

    // move visible stuff to left half of screen
    d3.selectAll(".node, .link")
        .transition()
        .duration(500)
        .attr("transform",
              "translate(" + deltaX + "," + deltaY + ")" +
              "scale(" + targetScale + " " + targetScale +")"
             )
        .on("end", function() {
            d3.select(".fighterChart")
                .transition()
                .duration(600)
                .attr("opacity", 1)
            
            // if simulation has ended, we need to restart it since
            // most of the invisible nodes have been "clamped" to the
            // sides of our visible area. But if we move towards those
            // nodes, we want to re-simulate since they might not
            // get clamped once the view has shifted
            d3simulation.tick();
        })

    selectedTranslateX = deltaX;
    selectedTranslateY = deltaY;
    selectedScale = targetScale;

    clampAndPositionNetwork();
}

function clampAndPositionNetwork() {
    d3nodes.selectAll("circle")
        .attr("cx", function(d) { return clampX(d.x); })
        .attr("cy", function(d) { return clampY(d.y); });


    // I have no clue why, but calculating the positions for the labels
    // takes an extremely long time, especially after the weight class
    // filters have been toggled on/off many times.
    // As a workaround, the positions will ONLY be updated when they are
    // supposed to be visible anyways
    if(tooltipFocusId !== "" || selectedFighterId !== "") {
        var opponentIds;
        
        if(selectedFighterId !== "") {
            opponentIds = getOpponentIds(selectedFighterId);
            opponentIds.push(selectedFighterId); // hack: display the selected fighter too
        }
        else {
            opponentIds = getOpponentIds(tooltipFocusId);
        }
        
        for(var i = 0; i < opponentIds.length; i++) {
            placeLabel(opponentIds[i]);
        }
    }

    d3links
        .attr("x1", function(d) { return clampX(d.source.x); })
        .attr("y1", function(d) { return clampY(d.source.y); })
        .attr("x2", function(d) { return clampX(d.target.x); })
        .attr("y2", function(d) { return clampY(d.target.y); });
}

// instead of iterating over all labels and hiding them
// this is more efficient because it knows the id that the
// visible labels are connected to, and only has to worry about
// hiding them
function hideAdjacentLabels(id) {
    ids = getOpponentIds(id);
    ids.push(id);
    
    for(var i = 0; i < ids.length; i++) {
        var label = getSvgLabelForFighter(ids[i]);

        if(label != null) {
            label
                .style("opacity", 0);
        }
    }
}

// note: this only places it
// make sure it is shown with showAdjacentLabels
function placeLabel(id) {
    var label = getSvgLabelForFighter(id);

    if(label != null) {
        label
            .attr("x", function(d) {
                var circle = getSvgCircleForFighter(d.id);
                return parseFloat(circle.attr("cx"));
            })
            .attr("y", function(d, _, textNodeList) {
                var circle = getSvgCircleForFighter(d.id);
                var textHeight = textNodeList[0].getBBox().height;
                return parseFloat(circle.attr("cy")) + textHeight + 8;
            });
    }
}

function showAdjacentLabels(id, includeSelected) {
    ids = getOpponentIds(id);

    if(includeSelected) {
        ids.push(id);
    }
    
    for(var i = 0; i < ids.length; i++) {
        var label = getSvgLabelForFighter(ids[i]);

        if(label != null) {
            label
                .style("opacity", function(d) {
                    if(d.id === id) {
                        return 1;
                    }

                    return .6;
                })
                .style("font-weight", function(d) {
                    if(d.id === id) {
                        return "bold";
                    }

                    return "normal";
                })
                .style("font-size", function(d) {
                    if(d.id === id) {
                        return 12;
                    }

                    return 12 / selectedScale;
                })
            
            placeLabel(ids[i]);
        }

    }
}

// note: tooltip must be rendered before calling this
// so we can use the tooltip's width/height in our calculations
function placeFightTooltip(smallTooltip, svgCircle) {
    var tooltipCenterX = parseFloat(svgCircle.attr("cx"));
    var tooltipCenterY = parseFloat(svgCircle.attr("cy"));
    
    var svgPos = document.getElementById("theSvg").getBoundingClientRect();
    
    smallTooltip
        .style("left", (svgPos.left + tooltipCenterX - getSmallToolTipWidth() / 2 - 32) + "px")
        .style("top", (svgPos.top + tooltipCenterY) + "px")
        .style("transform", "translate(" +
               -getSmallToolTipWidth() / 2 + "px," +
               -getSmallToolTipHeight() / 2 + "px)")
}

// note: tooltip must be rendered before calling this
// so we can use the tooltip's width/height in our calculations
function placeFighterTooltip(tooltip) { 
    var halfTooltipWidth = getToolTipWidth() / 2;
    var halfTooltipHeight = getToolTipHeight() / 2;
    
    function calculatePositionForFighterTooltip() {
        var result = { x: 0, y: 0 }
        
        var circle = getSvgCircleForFighter(tooltipFocusId);
        var fighter = fighters[tooltipFocusId];

        var nodeX = parseFloat(circle.attr("cx")) * selectedScale + selectedTranslateX;
        var nodeY = parseFloat(circle.attr("cy")) * selectedScale + selectedTranslateY;

        // add unit vectors of opponents relative positions together
        // the tooltip will be placed in the opposite direction
        var opponentVector = { x: 0, y: 0 }
        
        for(var i = 0; i < fighter.fightList.length; i++) {
            var opponentId = fighter.fightList[i].opponentId;

            var opponentCircle = getSvgCircleForFighter(opponentId);

            if(opponentCircle !== null) {
                var deltaX = parseFloat(opponentCircle.attr("cx")) - nodeX;
                var deltaY = parseFloat(opponentCircle.attr("cy")) - nodeY;

                var len = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                
                opponentVector.x += deltaX / len;
                opponentVector.y += deltaY / len;
            }
        }

        if(opponentVector.x === 0 && opponentVector.y === 0) {
            opponentVector.x = -1;
        }
        
        // normalize
        opponentVectorLen = Math.sqrt(opponentVector.x * opponentVector.x + opponentVector.y * opponentVector.y);
        opponentVector.x /= opponentVectorLen;
        opponentVector.y /= opponentVectorLen;

        var tooltipMaxDim = Math.max(getToolTipWidth(), getToolTipHeight());

        result.x = nodeX - (tooltipMaxDim * .75 * opponentVector.x);
        result.y = nodeY - (tooltipMaxDim * .75 * opponentVector.y);
        
        result.x = Math.min(Math.max(halfTooltipWidth, result.x), width - halfTooltipWidth);
        result.y = Math.min(Math.max(halfTooltipHeight, result.y), height - halfTooltipHeight);

        return result;
    }
    
    var tooltipCenter = calculatePositionForFighterTooltip();

    var svgPos = document.getElementById("theSvg").getBoundingClientRect();
                        
    tooltip
        .style("left", svgPos.left + (tooltipCenter.x) + "px")
        .style("top", svgPos.top + (tooltipCenter.y) + "px")
        .style("transform", "translate(" +
               -getToolTipWidth() / 2 + "px," +
               -getToolTipHeight() / 2 + "px)")
}

function getToolTipWidth() {
    return d3.select(".largeTooltip").node().getBoundingClientRect().width;
}

function getToolTipHeight() {
    return d3.select(".largeTooltip").node().getBoundingClientRect().height;
}

function getSmallToolTipWidth() {
    return d3.select(".smallTooltip").node().getBoundingClientRect().width;
}

function getSmallToolTipHeight() {
    return d3.select(".smallTooltip").node().getBoundingClientRect().height;
}

// example: 68 -> 5' 8"
function inchesToHeightStr(inches) {
    if(typeof inches === 'string') {
        inches = parseInt(inches);
    }

    var ft = Math.floor(inches / 12);
    var in_ = inches % 12;

    return ft + "' " + in_ + '"';
}

function getOpponentIds(id) {
    var result = [];
    var fighter = fighters[id];
    
    for(var i = 0; i < fighter.fightList.length; i++) {
        var opponentId = fighter.fightList[i].opponentId;
        result.push(opponentId);
    }

    return result;
}

function isOpponentOf(queryId, fighterId) {
    var fighter = fighters[fighterId];
    
    for(var i = 0; i < fighter.fightList.length; i++) {
        var opponentId = fighter.fightList[i].opponentId;

        if(queryId === opponentId) {
            return true;
        }
    }

    return false;
}

function fighterClicked(fighter) {
    // hide old selection
    if(selectedFighterId !== "") {
        hideAdjacentLabels(selectedFighterId);
    }
    
    selectedFighterId = fighter.id;
    
    // set tooltip to invisible
    tooltip
        .style("opacity", 0)
    
    // make all non-selected stuff invisible
    d3.selectAll(".node circle")
        .style("opacity", function(d) {
			if(d.name == "Matt Hughes") {
				var foo = 3;
			}
            if(fighter.id === d.id) {
                return 1;
            }

            for(var i = 0; i < fighter.fightList.length; i++) {
                var opponentId = fighter.fightList[i].opponentId;

                if (opponentId === d.id) {
                    return 1
                }
            }
            
            return 0;
        })
        .each(function(d) {
            var selection = d3.select(this);
            
            if(fighter.id === d.id) {
                selection.classed("unselected", false);
                selection.classed("selected", true);
                return;
            }

            for(var i = 0; i < fighter.fightList.length; i++) {
                var opponentId = fighter.fightList[i].opponentId;

                if (opponentId === d.id) {
                    selection.classed("unselected", false);
                    selection.classed("selected", true);
                    return;
                }
            }

            selection.classed("unselected", true);
            selection.classed("selected", false);
            return;
        })

        // fade opacity of non-connected links
        d3.selectAll(".link line")
        .style("opacity", function(d) {
            if(fighter.id === d.source.id ||
               fighter.id === d.target.id) {
				d.restoreOpacity = 1;
                return 1;
            }

            if(isOpponentOf(d.source.id, fighter.id) &&
               isOpponentOf(d.target.id, fighter.id)) {
				d.restoreOpacity = .1;
                return .1;
            }

			d.restoreOpacity = 0;
            return 0;
        })
        .each(function(d) {
            var selection = d3.select(this);
            
            if(fighter.id === d.source.id ||
               fighter.id === d.target.id) {
                selection.classed("unselected", false);
                selection.classed("selected", true);
                return;
            }

            if(isOpponentOf(d.source.id, fighter.id) &&
               isOpponentOf(d.target.id, fighter.id)) {
                selection.classed("unselected", false);
                selection.classed("selected", true);
                return;
            }
            
            selection.classed("unselected", true);
            selection.classed("selected", false);
        })

            d3.selectAll(".unselected")
        .attr("cursor", "default")
        .attr("pointer-events", "none")

    d3.selectAll(".selected")
        .attr("cursor", "pointer")
        .attr("pointer-events", "auto")

    // Center on fighter and show labels
    centerOn(fighter.id);
    showAdjacentLabels(fighter.id, true);                   

    // Create chart for the selected fighter
    var minDate = fighter.fightList[0].date;
    var maxDate = fighter.fightList[0].date;

    for(var i = 1; i < fighter.fightList.length; i++) {
        var fight = fighter.fightList[i];
        minDate = Math.min(minDate, fight.date);
        maxDate = Math.max(maxDate, fight.date);
    }

    // re-cast to Date, b/c min/max return raw integer form
    minDate = new Date(minDate);
    maxDate = new Date(maxDate);

    var chartX = width / 2 + 100; //start of chart
    var chartY = labelMargin * 1.5;
    
    var chartWidth = width - chartX - 50;
    var chartHeight = height - chartY - labelMargin;
    
    var xScale = d3.scaleTime()
        .domain([minDate, maxDate])
        .range([chartX, chartX + chartWidth])

    var roundValues = [-1, -2, -3, -4, -5, 0, 5, 4, 3, 2, 1];
    var yScale = d3.scaleOrdinal()
        .domain(roundValues)
        .range(roundValues.map(
            function(d) {
                var bot = chartY + chartHeight;
                var top = chartY;

                var index = roundValues.indexOf(d);

                // linear interpolate
                return bot + (top - bot) * (index) / roundValues.length;
            })
              );

    var xAxis = d3.axisBottom()
        .scale(xScale)
        .ticks(d3.timeYear.every(1))
        .tickFormat(function(d) {
            return d.getFullYear();
        })
        .tickSizeOuter(0);

    var tickValues = roundValues;
    tickValues.splice(tickValues.indexOf(0), 1);
    
    var yAxis = d3.axisLeft()
        .scale(yScale)
        .tickValues(tickValues)
        .tickFormat(function(d) { return Math.abs(d) });

    // delete existing fighter chart (if there is one)
    d3.selectAll(".fightCircle")
        .data([])
        .exit()
        .remove()

    d3.select(".fighterChart")
        .remove()

    var d3Chart = svg.append("g")
        .attr("class", "fighterChart")
        .attr("opacity", 0); // start off hidden -- gets made visible at end of centerOn
    

    d3Chart.append("g").attr("class", "xAxis");
    d3Chart.append("g").attr("class", "yAxis");

    var winColor = "#00bb00";
    var lossColor = "#bb0000";
    var drawColor = "#bbbb00";

    function getColor(result) {
        if(result === "win") {
            return winColor;
        }
        else if (result === "loss") {
            return lossColor;
        }
        else {
            return drawColor;
        }

        return "#bbbbbb";
    }
    
    var winTextX = chartX - 50;
    var winTextY = yScale(3);
    
    d3Chart.append("text")
        .text("WON AFTER (#) ROUNDS *")
        .classed("yAxisLabel", true)
        .attr("text-anchor", "middle")
        .attr("font-family", "Arial")
        .attr("font-weight", "bold")
        .attr("fill", winColor)
        .attr("x", winTextX)
        .attr("y", winTextY)
        .attr("transform", "rotate(-90, " + winTextX + ", " + winTextY + ")");

    var lossTextX = chartX - 50;
    var lossTextY = yScale(-3);
    
    d3Chart.append("text")
        .text("LOST AFTER (#) ROUNDS *")
        .classed("yAxisLabel", true)
        .attr("text-anchor", "middle")
        .attr("font-family", "Arial")
        .attr("font-weight", "bold")
        .attr("fill", lossColor)
        .attr("x", lossTextX)
        .attr("y", lossTextY)
        .attr("transform", "rotate(-90, " + lossTextX + ", " + lossTextY + ")");

    d3Chart.append("text")
        .text("* Standard fights go a maximum of 3 rounds - Title fights go a maximum of 5")
        .attr("x", chartX + 16)
        .attr("y", chartY + chartHeight + 40)
        .attr("font-family", "Arial")
        .attr("font-style", "italic")
        .attr("font-size", 12)
    
    var fightCircles = d3Chart.append("g")
        .attr("class", "fightCircle")
        .selectAll("fighterCircle")
        .data(fighter.fightList)
        .enter().append("g");

    d3Chart.append("image")
        .attr("xlink:href", "exit.png")
        .attr("width", 20)
        .attr("height", 20)
        .attr("x", chartX + chartWidth - 20)
        .attr("y", chartY - 20)
        .attr("cursor", "pointer")
        .on("click", function () {
            selectedFighterId = "";
            tooltipFocusId = "";

            d3.selectAll(".selected, .unselected")
                .attr("cursor", "pointer")
                .attr("pointer-events", "auto")
                .classed("selected", false)
                .classed("unselected", false);

            d3.selectAll(".node circle")
                .style("opacity", 1);

            d3.selectAll(".link line")
                .style("opacity", defaultLinkOpacity);

            d3.select(".fighterChart")
                .remove()

            d3.selectAll(".weightLabel")
                .style("visibility", "visible")
            
            hideAdjacentLabels(fighter.id);

            createInfoViz(getSelectedWeightClasses(), minFightCount)
        })

    d3Chart.append("text")
        .attr("font-family", "Arial")
        .attr("font-size", 24)
        .attr("text-anchor", "middle")
        .attr("x", chartX + chartWidth / 2)
        .attr("y", chartY)
        .text(fighter.name + "'s Fight History")
    
    svg.select(".xAxis")
        .attr("transform", "translate(0, " + yScale(0) + ")")
        .call(xAxis);

    svg.select(".yAxis")
        .attr("transform", "translate(" + (chartX - 10) + ", 0)")
        .call(yAxis);

    fightCircles.append("line")
        .classed("fightStem", true)
        .attr("stroke", function(d) {
            return getColor(d.result);
        })
        .attr("x1", function(d) {
            return xScale(d.date);
        })
        .attr("x2", function(d) {
            return xScale(d.date);
        })
        .attr("y1", function(d) {
            // note: this doesn't accurately go to the center
            // if the center has an offset. But offsets are
            // aligned so the circles all touch, so this line
            // will be hidden underneath anyways
            if(d.result === "win") {
                return yScale(d.round);
            }
            else if (d.result === "loss") {
                return yScale(-d.round);
            }

            return yScale(0);
        })
        .attr("y2", function(d) {
            return yScale(0);
        })
    
    fightCircles.append("circle")
        .classed("fightDot", true)
        .attr("cx", function(d) {
            return xScale(d.date);
        })
        .attr("cy", function(d) {
            // fights earlier in the list that will overlap on the graph (same date, same round, same result)
            var overlappingFights = [];
            
            for(var i = 0; i < fighter.fightList.indexOf(d); i++) {
                var fight = fighter.fightList[i];

                if(fight.date.getTime() === d.date.getTime() && fight.result === d.result && fight.round === d.round) {
                    overlappingFights.push(fight);
                }
            }

            var offset = fightRadius * 2 * overlappingFights.length;

            if(d.result === "win") {
                return yScale(d.round) + offset;
            }
            else if (d.result === "loss") {
                return yScale(-d.round) - offset;
            }
            else {
                return yScale(0) - offset;
            }
            
        })
        .attr("r", fightRadius)
        .attr("fill", function(d) {
            return getColor(d.result);
        })
        .attr("stroke", function(d) {
            var selection = d3.select(this);
            
            var color;
            if(d.opponentId in visibleFighters) {
                color = selection.attr("fill");
                color = color.replace("b", "9");
            }
            else {
                color = "#bbbbbb";
            }

            // cache
            d.defaultStroke = color;

            return color;
        })
        .on("mouseover", function(d) {
            var selection = d3.select(this);
            selection
                .attr("stroke", "#000000");
            
            var winner = (d.result === "win") ? fighter.name : (d.result === "loss") ? d.opponentName : "draw";
            var nameString = "";
            var resultString = "";
            
            // Create tooltip
            if(d.result === "win") {
                resultString += "Win by " + d.method + " (" + d.details + ")";
            }
            else if (d.result === "loss") {
                resultString += "Loss by " + d.method + " (" + d.details + ")";
            }
            else {
                resultString += "Draw";
            }

            var dateString = d.date.toISOString().slice(0, 10);
            
            // var htmlString = nameString;
            // htmlString += "<hr>";
            var leftString = getTooltipHTMLForFighter(fighter.id, true);
            var rightString = getTooltipHTMLForFighter(d.opponentId, true);

            htmlString = "<table class='ttTable'>"
            htmlString += "<tr><th>" + fighter.name + "</th><th> vs. </th><th>" + d.opponentName + "</th>"
            htmlString += "<tr><td>" + leftString + "</td><td></td><td>" + rightString + "</td></tr>";
            htmlString += "</table>";

            htmlString += "<hr>";
            htmlString += "Date: " + dateString;
            htmlString += "<br>";
            htmlString += resultString;
            htmlString += "<br>";
            htmlString += d.round + " rounds";

            
            smallTooltip.html(htmlString);
            placeFightTooltip(smallTooltip, selection);
            

            smallTooltip.transition()
                .duration(0)
                .style("opacity", 1);

            var circle = getSvgCircleForFighter(d.opponentId);

            if(d.opponentId in visibleFighters) {
                // highlight node
                d3.selectAll(".node circle")
                    .filter(".selected")
                    .transition()
                    .duration(100)
                    .style("opacity", function(nodeD) {
                        if(fighter.id === nodeD.id || d.opponentId === nodeD.id) {
                            return 1;
                        }
                        
                        return .1;
                    })
                    .style("stroke", function(nodeD) {
                        if(fighter.id === nodeD.id || d.opponentId === nodeD.id) {
                            return "#000000";
                        }
                        
                        return "#FFFFFF";
                    })

                // highlight link
                d3.selectAll(".link line")
                    .filter(".selected")
                    .transition()
                    .duration(100)
                    .style("opacity", function(linkD) {
                        if((d.opponentId === linkD.source.id && fighter.id === linkD.target.id) ||
                           d.opponentId === linkD.target.id && fighter.id === linkD.source.id) {
                            return 1;
                        }
                        
                        return .1;
                    })
                    .style("stroke", function(linkD) {
                        if((d.opponentId === linkD.source.id && fighter.id === linkD.target.id) ||
                           d.opponentId === linkD.target.id && fighter.id === linkD.source.id) {
                            return "#000000";
                        }
                        
                        return defaultLinkStroke;
                    })
            }
        })
        .on("mouseout", function(d) {
            var selection = d3.select(this);
            selection
                .attr("stroke", d.defaultStroke);
            
            smallTooltip.transition()
                .duration(100)
                .style("opacity", 0);

            // restore opacity of other fighters
            d3.selectAll(".node circle")
                .filter(".selected")
                .transition()
                .duration(100)
                .style("opacity", 1)
                .style("stroke", "#FFFFFF")

            // restore opacity of other links
            d3.selectAll(".link line")
                .filter(".selected")
                .transition()
                .duration(100)
                .style("opacity", function(d) {
                    return d.restoreOpacity;
                })
                .style("stroke", defaultLinkStroke)
        })
        .on("click", function(d) {
            if(d.opponentId in visibleFighters) {
                d3.select("#smallTooltip")
                    .style("opacity", 0);

                ////////////
                // COPY-PASTED from mouseout because dispatching virtual
                // event isn't working, javascript sucks, and I'm tired
                //
                {
                    var selection = d3.select(this);
                    selection
                        .attr("stroke", d.defaultStroke);
                    
                    smallTooltip.transition()
                        .duration(100)
                        .style("opacity", 0);

                    // restore opacity of other fighters
                    d3.selectAll(".node circle")
                        .filter(".selected")
                        .style("opacity", 1)
                        .style("stroke", "#FFFFFF")

                    // restore opacity of other links
                    d3.selectAll(".link line")
                        .filter(".selected")
                        .style("opacity", defaultLinkOpacity)
                        .style("stroke", defaultLinkStroke)
                }
                //
                //
                // END COPY PASTE
                ///////////

                
                fighterClicked(fighters[d.opponentId]);
            }
        })
}


d3.csv("fighters.csv", function(data) {
    // Load all fighter data into memory
    for(var i = 0; i < data.length; i++) {
        var id = data[i]["fid"];
        var name = data[i]["name"];
        var wClass = data[i]["class"];
        var fighterHeight = data[i]["height"];
        var fighterWeight = data[i]["weight"];
        var fightList = [];

        if(weightClasses.indexOf(wClass) > -1) {
            fighters[id] = {
                id: id,
                name: name,
                wClass: wClass,
                fightList: fightList,
                weight: fighterWeight,
                height: fighterHeight
            };
        }
        else {
            console.log("Unknown weight class '" + wClass + "' for fighter " + name + " (" + id + ") ... Ignoring fighter.");
        }
    }

    // Now that fighters are loaded into memory,
    // read all of the fight data
    d3.csv("fights.csv", function(data) {
        for(var i = 0; i < data.length; i++) {
            var fight = data[i];
            var id1 = fight["f1fid"];
            var id2 = fight["f2fid"];
            var name1 = fight["f1name"];
            var name2 = fight["f2name"];
            var result1 = fight["f1result"];
            var result2 = fight["f2result"];
            var method = fight["method"].toLowerCase();
            var details = fight["method_d"].toLowerCase();
            var round = fight["round"];
            var date = fight["event_date"].split("/");

            var year = parseInt(date[2]);
            var day = parseInt(date[1]);
            var month = parseInt(date[0]);
            date = new Date(year, month - 1, day); // why are months 0-11... wtf javascript
            
            if(id1 in fighters && id2 in fighters) {
                if(result1 == "win" || result1 == "loss" || result1 == "draw")
                {
                    fighters[id1].fightList.push(
                        {
                            date: date,
                            opponentName: name2,
                            opponentId: id2,
                            result: result1,
                            round: round,
                            method: method,
                            details: details,
                            opponentWClass: fighters[id2].wClass
                        }
                    );

                    fighters[id2].fightList.push(
                        {
                            date: date,
                            opponentName: name1,
                            opponentId: id1,
                            result: result2,
                            round: round,
                            method: method,
                            details: details,
                            opponentWClass: fighters[id1].wClass
                        }
                    );
                }
                else {
                    console.log("Fight didn't result in win/loss/draw (results: " + result1 + "/" + result2 + ") ... Ignoring fight.");
                }
            }
            else {
                if (!(id1 in fighters)) {
                    console.log("Couldn't identify fighter " + name1 + "(" + id1 + ") ... Ignoring fight.");
                }
                if (!(id2 in fighters)) {
                    console.log("Couldn't identify fighter " + name2 + "(" + id2 + ") ... Ignoring fight.");
                }
            }
        }

        // Cache W-L and win % for each fighter
        for(var id in fighters) {
            var fighter = fighters[id];
            var winCount = 0;
            var lossCount = 0;
            var drawCount = 0;

            for(var i = 0; i < fighter.fightList.length; i++) {
                var fight = fighter.fightList[i];

                if(fight.result === "win") {
                    winCount += 1;
                }

                if(fight.result === "loss") {
                    lossCount += 1;
                }

                if(fight.result === "draw") {
                    drawCount += 1;
                }
            }

            fighter.winPercent = winCount / fighter.fightList.length;
            fighter.wins = winCount;
            fighter.losses = lossCount;
            fighter.draws = drawCount;
        }

        // Create list of all the matchups
        for(var id in fighters) {
            var fighter = fighters[id];

            // Keep a list of who we've already linked
            // so duplicate fights won't create a second link
            myLinkedOpponents = [];
            myLinks = [];

            for(var i = 0; i < fighter.fightList.length; i++) {
                var fight = fighter.fightList[i];

                if(!(fight.opponentId in fighters)) {
                    continue;
                }
                
                // only create link if your name comes first alphabetically,
                // so we don't create duplicate links
                if(id < fight.opponentId) {
                    var index = myLinkedOpponents.indexOf(fight.opponentId);
                    if(index === -1) {
                        var newLink = {
                                fighter1: id,
                                fighter2: fight.opponentId,
                                count: 1
                        };
                        
                        matchups.push(newLink);

                        // myLinkedOpponents and myLinks must have parallel indices
                        myLinkedOpponents.push(fight.opponentId);
                        myLinks.push(newLink);
                    }
                    else {
                        myLinks[index].count += 1;
                    }
                }
            }
        }

        // Insert DOM elements needed (svg, tooltips)
        svg = d3.select(".chart").append("svg")
            .attr("width", width)
            .attr("height", height)
            .attr("class", "svg")
            .attr("id", "theSvg");

        tooltip = d3.select(".chart").append("div");
        tooltip
            .classed("tooltip", true)
            .classed("largeTooltip", true)
            .style("opacity", 0);

        smallTooltip = d3.select(".chart").append("div");
        smallTooltip
            .classed("tooltip", true)
            .classed("smallTooltip", true)
            .style("opacity", 0);
        
        // Generate color scheme
        var color = d3.scaleOrdinal(d3.schemeCategory10);
        
        //
        // This function completely scratches whatever is currently
        // on the svg and rebuilds the network graphic from scratch
        //
        // wClasses - a list of strings describing which weight classes to include.
        //            null means include all of the weight classes.
        createInfoViz = function(wClasses, minFights) {

            selectedFighterId = "";
            tooltipFocusId = "";

            selectedTranslateX = 0;
            selectedTranslateY = 0;
            selectedScale = 1;

            d3.select(".fighterChart")
                .remove()
            
            if(d3nodes != null) {
                d3nodes = d3nodes.data([])
                d3nodes.exit().remove();
            }

            if(d3links != null) {
                d3links = d3links.data([])
                d3links.exit().remove();
            }

            if(d3simulation != null) {
                d3simulation.nodes([]);

                d3simulation.force("link")
                    .links([]);

                d3simulation.restart();
            }


            // sort the wClasses list ordinally
            if(wClasses == null) {
                wClasses = weightClasses;
            }
            else {
                wClasses.sort(function(a, b) {
                    return weightClasses.indexOf(a) - weightClasses.indexOf(b);
                });
            }
            
            // Clear whatever is currently on the svg
            svg.selectAll("*").remove();
			
            showSpinner();
            setTimeout(function() {

				function filter(id) {
					return wClasses.indexOf(fighters[id].wClass) !== -1 &&
						fighters[id].fightList.length >= minFights;
				}

				if(wClasses == null) {
					wClasses = weightClasses;
				}

				// Build list of nodes and links out of our master lists (fighters and fights)
				// That meet our filter criteria
				var nodes = [];
				var links = [];

				visibleFighters = {};
				
				// fighters is a dict, so iterate by key
				for(var id in fighters) {
					if(filter(id)) {
						nodes.push(fighters[id]);
						visibleFighters[id] = (fighters[id]);
					}
				}
				
				var visibleWeightClasses = weightClasses.slice();
				// Remove any of the unrepresented weight classes from our list
				// so that we don't draw labels, etc. for them
				{
					var countPerWeightClass = {};
					for(var i = 0; i < weightClasses.length; i++) {
						countPerWeightClass[weightClasses[i]] = 0;
					}
					
					for(var id in fighters) {
						var fighter = fighters[id];

						if(fighter.fightList.length >= minFights) {
							countPerWeightClass[fighter.wClass] += 1;
						}
					}

					for(var i = 0; i < visibleWeightClasses.length; i++) {
						if(countPerWeightClass[visibleWeightClasses[i]] === 0) {
							console.log("Removed weight class " + visibleWeightClasses[i] + " for having 0 fighters in it after filtering.");
							visibleWeightClasses.splice(i, 1); // remove i'th index
							i--; // decrement i to avoid skipping next element
						}
					}
				}

				// matchups is a list, so iterate normally
				for(var i = 0; i < matchups.length; i++) {
					var matchup = matchups[i];
					var id1 = matchup.fighter1;
					var id2 = matchup.fighter2;

					if(filter(id1) && filter(id2)) {
						links.push(
							{
								source: fighters[id1],
								target: fighters[id2],
								count: matchup.count
							}
						);
					}
				}

				var percentOfFightersVisible = nodes.length / Object.keys(visibleFighters).length;
				
				d3simulation = d3.forceSimulation().stop()
					.nodes(nodes)
					.force(
						"link",
						// This force attracts nodes that are connected
						d3.forceLink()
							.links(links)
							.id(function(d) {
								return d.id;
							})
							.distance(function(d) {
								// var dist = 1;
								// var weightClassDifference = Math.abs(
								//  visibleWeightClasses.indexOf(d.source.wClass) - visibleWeightClasses.indexOf(d.target.wClass));
								
								// dist += 2 * weightClassDifference;
								// dist *= 200 * (1 - percentOfFightersVisible);
								// return dist;

								return 75 + 150 * (1 - percentOfFightersVisible);
							})
					)
					.force(
						// This force repels nodes away from each other
						"charge",
						d3.forceManyBody()
							.distanceMax(300)
							.strength(-100)
					)
					.force(
						// This force centers the network as a whole around the center of the screen
						"center",
						d3.forceCenter()
							.x(width / 2)
							.y((labelMargin + (height - labelMargin)) / 2)
					)
					.force(
						// This force should position the lighter weight clusters to the left and
						// heavier ones to the right
						"xPosForce",
						d3.forceX(function(d) {
							var result = getXForWeightClass(d.wClass, wClasses);
							return result;
						})
					)
					.force(
						// This force prevents things from drifting too high up/down)
						"yPosForce",
						d3.forceY(function(d) {
							return labelMargin + (height - labelMargin) / 2;
						})
					);
				
				d3links = svg.append("g")
					.attr("class", "link")
					.selectAll("line")
					.data(links)
					.enter().append("line")
					.attr("stroke-width", function(d) {
						// max # of head2head fights in our data set is 3
						// but put a hard cap on this just for good measure
						return Math.min(1 + 2 * d.count, 11);
					})
					.style("opacity", defaultLinkOpacity)
					.attr("stroke", defaultLinkStroke);

				d3nodes = svg.append("g")
					.attr("class", "node")
					.selectAll(".node")
					.data(nodes)
					.enter().append("g");

				d3nodes.append("circle")
					.attr("r", function(d) {
						var sparseness = 1 - percentOfFightersVisible;
						d.radius = (1 + 10 * d.winPercent) * (1 + 1 * sparseness);
						return d.radius;
					})
					.attr("id", function(d) {
						// storing this as DOM id so we can easily look up a node for a given fighter
						return "node" + d.id
					})
					.attr("fill", function(d) {
						return color(weightClasses.indexOf(d.wClass));
					})
					.on("mouseover", function(fighter) {
						// Create tooltip
						var htmlString = getTooltipHTMLForFighter(fighter.id, false);

						tooltipFocusId = fighter.id;

						tooltip.html(htmlString);
						placeFighterTooltip(tooltip);
						

						tooltip.transition()
							.duration(0)
							.style("opacity", 1);

						
						if(selectedFighterId === "") {
							// fade opacity of non-connected fighters
							d3.selectAll(".node circle")
								.transition()
								.duration(100)
								.style("opacity", function(d) {
									if(fighter.id === d.id) {
										return 1;
									}

									for(var i = 0; i < fighter.fightList.length; i++) {
										var opponentId = fighter.fightList[i].opponentId;

										if (opponentId === d.id) {
											return 1
										}
									}
									
									return .1;
								})

							// fade opacity of non-connected links
							d3.selectAll(".link line")
								.transition()
								.duration(100)
								.style("opacity", function(d) {
									if(fighter.id === d.source.id ||
									   fighter.id === d.target.id) {
										return 1;
									}
									
									return .1;
								})

							// show name labels of connected fighters
							showAdjacentLabels(fighter.id, false);
						}
						else {
							d3.selectAll(".fightDot")
								.transition()
								.duration(100)
								.style("stroke", function(d) {
									if(d.opponentId === fighter.id) {
										return "#000000";
									}
									
									return d.defaultStroke;
								})
								.style("stroke-width", function(d) {
									if(d.opponentId === fighter.id) {
										return fightStrokeWidth * 1.5 + "px";
									}
									
									return fightStrokeWidth + "px";
								})
								.attr("r", function(d) {
									if(d.opponentId === fighter.id) {
										return fightRadius * 2;
									}
									
									return fightRadius;
								})
						}
					})
					.on("mouseout", function(fighter) {
						// hide tooltip
						tooltip.transition()
							.duration(100)
							.style("opacity", 0);

						tooltipFocusId = "";

						if(selectedFighterId === "") {
							// restore opacity of non-connected fighters and links
							d3.selectAll(".node circle")
								.transition()
								.duration(100)
								.style("opacity", 1)

							d3.selectAll(".link line")
								.transition()
								.duration(100)
								.style("opacity", defaultLinkOpacity)
							
							// hide all fighter labels
							var opponentIds = getOpponentIds(fighter.id);
							for(var i = 0; i < opponentIds.length; i++) {
								var label = getSvgLabelForFighter(opponentIds[i]);

								if(label != null) {
									label
										.transition()
										.duration(100)
										.style("opacity", 0)
								}
							}
						}

						d3.selectAll(".fightDot")
							.transition()
							.duration(100)
							.style("stroke", function(d) {
								return d.defaultStroke;
							})
							.style("stroke-width", fightStrokeWidth + "px")
							.attr("r", fightRadius)

					})
					.on("click", fighterClicked)

				d3nodes.append("text")
					.text(function(d) { return d.name })
					.attr("id", function(d) {
						// storing this as DOM id so we can easily look up a node for a given fighter
						return "label" + d.id
					})
					.attr("font-family", "Arial")
					.attr("text-anchor", "middle")
					.attr("class", "fighterLabel")
					.style("opacity", 0)
					.attr("font-size", 12)

                for(var i = 500; i > 0; --i) {
                    d3simulation.tick();
                }

                clampAndPositionNetwork();

                if(tooltipFocusId !== "" && selectedFighterId !== "") {
                    placeFighterTooltip(tooltip);
                }

                // Create weight class labels
                for(var i = 0; i < visibleWeightClasses.length; i++) {
                    var wClass = visibleWeightClasses[i];
                    
                    svg.append("text")
                        .attr("x", getXForWeightClass(wClass, visibleWeightClasses))
                        .attr("y", function() {
                            if(i % 2 === 0) {
                                return labelMargin / 3;
                            }
                            else {
                                return 2 * labelMargin / 3;
                            }
                        })
                        .attr("text-anchor", "middle")
                        .attr("font-size", labelMargin / 3.5)
                        .attr("fill", (function(closureValue) {
                            return function() {
                                if(selectedWeightClasses[closureValue]) {
                                    return color(weightClasses.indexOf(closureValue));
                                }
                                else {
                                    return "#aaaaaa";
                                }
                            }
                        })(wClass))
                        .attr("text-decoration", (function(closureValue) {
                            return function() {
                                if(selectedWeightClasses[closureValue]) {
                                    return "none";
                                }
                                else {
                                    return "line-through";
                                }
                            }
                        })(wClass))
                        .text(wClass)
                        .attr("class", "weightLabel")
                        .on("mousemove", (function(closureValue) {
                            return function() {
                                var htmlString =
                                    "<b>" + weightDescriptions[closureValue] + "</b>" +
                                    "<hr>" +
                                    countPerWeightClass[closureValue] + " fighters";
                                
                                tooltip.transition()
                                    .duration(100)
                                    .style("opacity", 1);

                                tooltip.html(htmlString)
                                    .style("left", (d3.event.pageX) + "px")
                                    .style("top", (d3.event.pageY + 30) + "px")
                                    .style("transform", "translate(" +
                                           (-(getToolTipWidth() / 2) + 6) + "px, 0px)");
                            }
                        })(wClass))
                        .on("mouseover", (function(closureValue) {
                            return function() {
                                d3.selectAll(".node circle")
                                    .transition()
                                    .duration(100)
                                    .style("stroke", function(d) {
                                        if(d.wClass === closureValue) {
                                            return "#000000"; 
                                        }
                                        else {
                                            return "#FFFFFF";
                                        }
                                    })

                                d3.selectAll(".link line")
                                    .transition()
                                    .duration(100)
                                    .style("stroke", function(d) {
                                        if(d.source.wClass === closureValue && d.target.wClass === closureValue ||
                                           d.source.id == selectedFighterId && d.target.wClass === closureValue ||
                                           d.target.id == selectedFighterId && d.source.wClass === closureValue) {
                                            return "#000000";
                                        }
                                        else {
                                            return defaultLinkStroke;
                                        }
                                    })

                                d3.selectAll(".fightDot")
                                    .transition()
                                    .duration(100)
                                    .style("stroke", function(d) {
                                        if(d.opponentWClass === closureValue) {
                                            return "#000000";
                                        }
                                        
                                        return d.defaultStroke;
                                    })
                            }
                        })(wClass))
                        .on("mouseout", function() {
                            tooltip.transition()
                                .duration(100)
                                .style("opacity", 0);

                            d3.selectAll(".node circle")
                                .transition()
                                .duration(100)
                                .style("stroke", "#FFFFFF")

                            d3.selectAll(".link line")
                                .transition()
                                .duration(100)
                                .style("stroke", defaultLinkStroke)

                            d3.selectAll(".fightDot")
                                .transition()
                                .duration(100)
                                .style("stroke", function(d) {
                                    return d.defaultStroke;
                                })
                        })
                        .on("click", (function(closureValue) {
                            return function() {
                                // toggle
                                selectedWeightClasses[closureValue] = !selectedWeightClasses[closureValue];

                                createInfoViz(getSelectedWeightClasses(), minFightCount)
                            }
                        })(wClass));
                }

                hideSpinner();
            }, 100);
        }

        createInfoViz(getSelectedWeightClasses(), minFightCount);
    });
});


////////////////
// Add listener to search submit button
////////////////
document.getElementById("searchName").addEventListener("keydown", function(e) {
    if(e.keyCode === 13) {
        document.getElementById("searchSubmit").click();
    }
})

document.getElementById("searchSubmit").addEventListener("click", function() {
    var name = document.getElementById("searchName").value;

    if(name === "") {
        return;
    }

    d3.selectAll(".node circle")
        .transition("searchHighlight")
        .duration(250)
        .attr("r", function(d) {
            if(d.name.toLowerCase().indexOf(name.toLowerCase()) === -1) {
                return d.radius;
            }
            
            return d.radius + 8;
        })
        .style("stroke", function(d) {
            if(d.name.toLowerCase().indexOf(name.toLowerCase()) === -1) {
                return "#ffffff";
            }
            
            return "#000000";
        })
        .style("stroke-width", function(d) {
            if(d.name.toLowerCase().indexOf(name.toLowerCase()) === -1) {
                return nodeStrokeWidth + "px";
            }
            
            return nodeStrokeWidth * 1.5 + "px";
        })
        .transition("restore")
        .delay(500)
        .duration(250)
        .attr("r", function(d) {
            return d.radius;
        })
        .style("stroke", function(d) {
            return "#FFFFFF";
        })
        .style("stroke-width", function(d) {
            return nodeStrokeWidth + "px";
        })

        d3.selectAll(".fightDot")
        .transition("searchHighlight")
        .duration(250)
        .attr("r", function(d) {
            if(d.opponentName.toLowerCase().indexOf(name.toLowerCase()) === -1) {
                return fightRadius;
            }
            
            return fightRadius * 2;
        })
        .style("stroke", function(d) {
            if(d.opponentName.toLowerCase().indexOf(name.toLowerCase()) === -1) {
                return d.defaultStroke;
            }
            
            return "#000000";
        })
        .style("stroke-width", function(d) {
            if(d.opponentName.toLowerCase().indexOf(name.toLowerCase()) === -1) {
                return fightStrokeWidth + "px";
            }
            
            return fightStrokeWidth * 1.5 + "px";
        })
        .transition("restore")
        .delay(500)
        .duration(250)
        .attr("r", function(d) {
            return fightRadius;
        })
        .style("stroke", function(d) {
            return d.defaultStroke;
        })
        .style("stroke-width", function(d) {
            return fightStrokeWidth + "px";
        })
    
    return false;
});

////////////////
//// Dynamically insert minimum # of fighters so we only have to set the variable
////////////////
{
    var countText = document.getElementById("mfc");
    countText.innerHTML = minFightCount;
}

////////////////
//// Add listeners to +- buttons
////////////////
{
    document.getElementById("plus").addEventListener("click", function() {
        var max = 25;
        
        if(minFightCount >= max) {
            return;
        }
        
        minFightCount += 1;
        createInfoViz(getSelectedWeightClasses(), minFightCount);

        var countText = document.getElementById("mfc");
        countText.innerHTML = minFightCount;

        if(minFightCount >= max) {
            document.getElementById("plus").disabled = true;
        }

        document.getElementById("minus").disabled = false;
    });

    document.getElementById("minus").addEventListener("click", function() {
        var min = 5;
        
        if(minFightCount <= min) {
            return;
        }
        
        minFightCount -= 1;
        createInfoViz(getSelectedWeightClasses(), minFightCount);

        var countText = document.getElementById("mfc");
        countText.innerHTML = minFightCount;

        if(minFightCount <= min) {
            document.getElementById("minus").disabled = true;
        }

        document.getElementById("plus").disabled = false;
    });
}

////////////////
//// Initialize spinner
////////////////
{
    var dims = document.getElementById("spinner").getBoundingClientRect();
    
    d3.select("#spinner")
        .style("left", (window.innerWidth - dims.width) / 2 + "px")
        .style("top", (window.height - dims.height) / 2 + "px")
        .style("visibility", "visible")
}

function showSpinner() {
    d3.select("#spinner")
        .style("visibility", "visible")
}

function hideSpinner() {
    d3.select("#spinner")
        .style("visibility", "hidden")
}
