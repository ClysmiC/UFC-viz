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
selectedWeightClasses["Atomweight"] = false;
selectedWeightClasses["Strawweight"] = false;
selectedWeightClasses["Flyweight"] = false;
selectedWeightClasses["Bantamweight"] = false;
selectedWeightClasses["Featherweight"] = false;
selectedWeightClasses["Lightweight"] = false;
selectedWeightClasses["Welterweight"] = false;
selectedWeightClasses["Middleweight"] = false;
selectedWeightClasses["Light Heavyweight"] = false;
selectedWeightClasses["Heavyweight"] = false;
selectedWeightClasses["Super Heavyweight"] = false;

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

// fighters with less than this number of fights aren't shown on the network
var MIN_FIGHT_COUNT = 10;

// svg dimensions
var width = window.innerWidth - 100
var height = window.innerHeight - 10;

// space allocated at top of svg exclusively for the labels
var labelMargin = 100;

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

	return width / weightClassList.length * (i + .5);
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

function getSvgCircleForFighter(id) {
	var circle = d3.select("#node" + id);
	
	if(circle.empty()) {
		return null;
	}

	return circle;
}

// note: tooltip must be rendered before calling this
// so we can use the tooltip's width/height in our calculations
function placeTooltip(tooltip) {
	function calculatePositionForFighterTooltip() {
		var result = { x: 0, y: 0 }
		
		var circle = getSvgCircleForFighter(tooltipFocusId);
		var fighter = fighters[tooltipFocusId];

		var myX = parseFloat(circle.attr("cx"));
		var myY = parseFloat(circle.attr("cy"));

		// add unit vectors of opponents relative positions together
		// the tooltip will be placed in the opposite direction
		var opponentVector = { x: 0, y: 0 }
		
		for(var i = 0; i < fighter.fightList.length; i++) {
			var opponentId = fighter.fightList[i].opponentId;

			var opponentCircle = getSvgCircleForFighter(opponentId);

			if(opponentCircle !== null) {
				var deltaX = parseFloat(opponentCircle.attr("cx")) - myX;
				var deltaY = parseFloat(opponentCircle.attr("cy")) - myY;

				var len = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
				
				opponentVector.x += deltaX / len;
				opponentVector.y += deltaY / len;
			}
		}

		// normalize
		opponentVectorLen = Math.sqrt(opponentVector.x * opponentVector.x + opponentVector.y * opponentVector.y);
		opponentVector.x /= opponentVectorLen;
		opponentVector.y /= opponentVectorLen;

		var tooltipMaxDim = Math.max(getToolTipWidth(), getToolTipHeight());

		result.x = myX - (tooltipMaxDim * .75 * opponentVector.x);
		result.y = myY - (tooltipMaxDim * .75 * opponentVector.y);

		return result;
	}
	
	var tooltipCenter = calculatePositionForFighterTooltip();
	
	tooltip
		.style("left", (tooltipCenter.x) + "px")
		.style("top", (tooltipCenter.y) + "px")
		.style("transform", "translate(" +
			   -getToolTipWidth() / 2 + "px," +
			   -getToolTipHeight() / 2 + "px)")
}

function getToolTipWidth() {
	return d3.select(".tooltip").node().getBoundingClientRect().width;
}

function getToolTipHeight() {
	return d3.select(".tooltip").node().getBoundingClientRect().height;
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
			
			if(id1 in fighters && id2 in fighters) {
				if(result1 == "win" || result1 == "loss" || result1 == "draw")
				{
					fighters[id1].fightList.push(
						{
							opponentName: name2,
							opponentId: id2,
							result: result1
						}
					);

					fighters[id2].fightList.push(
						{
							opponentName: name1,
							opponentId: id1,
							result: result2
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

		// Now that fight data is loaded into memory, remove any fighters
		// that have < MIN_FIGHT_COUNT
		{
			var removeList = [];
			
			for(var id in fighters) {
				var fighter = fighters[id];

				if(fighter.fightList.length < MIN_FIGHT_COUNT) {
					removeList.push(id);
				}
			}

			for(var i = 0; i < removeList.length; i++) {
				var removeId = removeList[i];
				delete fighters[removeId];
			}

			console.log("Removed " + removeList.length + " fighters for having < " + MIN_FIGHT_COUNT + " fights ... " + Object.keys(fighters).length + " fighters remain.");
		}

		// Remove any of the unrepresented weight classes from our master list
		// so that we don't draw labels, etc. for them
		{
			var countPerWeightClass = {};
			for(var i = 0; i < weightClasses.length; i++) {
				countPerWeightClass[weightClasses[i]] = 0;
			}
			
			for(var id in fighters) {
				var fighter = fighters[id];
				countPerWeightClass[fighter.wClass] += 1;
			}

			for(var i = 0; i < weightClasses.length; i++) {
				if(countPerWeightClass[weightClasses[i]] === 0) {
					console.log("Removed weight class " + weightClasses[i] + " for having 0 fighters in it after filtering.");
					weightClasses.splice(i, 1); // remove i'th index
					i--; // decrement i to avoid skipping next element
				}
				else {
					selectedWeightClasses[weightClasses[i]] = true;
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

		// Create list of all the links
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
		var svg = d3.select(".chart").append("svg")
			.attr("width", width)
			.attr("height", height)
			.attr("class", "svg");

		var tooltip = d3.select(".chart").append("div");
		tooltip.attr("class", "tooltip")
			.style("opacity", 0);

		tooltipFocusId = "";

		// Generate color scheme
		var color = d3.scaleOrdinal(d3.schemeCategory20);

		var d3nodes;
		var d3links;
		var d3simulation;
		
		//
		// This function completely scratches whatever is currently
		// on the svg and rebuilds the network graphic from scratch
		//
		// wClasses - a list of strings describing which weight classes to include.
		//            null means include all of the weight classes.
		function createInfoViz(wClasses) {

			// This is the function that should always be called when reconstructing
			// the infoviz. createInfoViz should only be called directly the first
			// time the infoviz gets generated.
			function regenerateInfoViz(wClasses) {											

				// not 100% how this is working but it is clearing out all
				// the data that already exists so the graph can rebuild
				// without any memory leaks
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
				}

				d3simulation.restart();

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
				
				createInfoViz(wClasses);
			}

			function filter(id) {
				return wClasses.indexOf(fighters[id].wClass) !== -1;
			}

			// Build list of nodes and links out of our master lists (fighters and fights)
			// That meet our filter criteria
			var nodes = [];
			var links = [];

			// fighters is a dict, so iterate by key
			for(var id in fighters) {
				if(filter(id)) {
					nodes.push(fighters[id]);
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

			var percentOfFightersVisible = nodes.length / Object.keys(fighters).length;
				  
			d3simulation = d3.forceSimulation()
				.nodes(nodes)
				.on("tick", ticked)
				.force(
					"link",
					// This force attracts nodes that are connected
					d3.forceLink()
						.links(links)
						.id(function(d) {
							return d.id;
						})
						.distance(75 + 100 * (1 - percentOfFightersVisible))
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
						.y(labelMargin + (height - labelMargin) / 2)
				)
				.force(
					// This force should position the lighter weight clusters to the left and
					// heavier ones to the right
					"xPosForce",
					d3.forceX(function(d) {
						var result = getXForWeightClass(d.wClass, wClasses);
						return result;
					})
				);

			var d3links = svg.append("g")
				.attr("class", "link")
				.selectAll("line")
				.data(links)
				.enter().append("line")
				.attr("stroke-width", function(d) {
					return 1 + 2 * d.count;
				})
				.attr("opacity", function(d) {
					// cache the opacity here. that way when we set it to 0,
					// we know what to set it back to when it is reappearing
					d.defaultOpacity = 0.4;
					
					return d.defaultOpacity;
				});

			d3nodes = svg.append("g")
				.attr("class", "node")
				.selectAll("nodes")
				.data(nodes)
				.enter().append("g");

			d3nodes.append("circle")
				.attr("r", function(d) {
					var sparseness = 1 - percentOfFightersVisible;
					return (1 + 10 * d.winPercent) * (1 + 1 * sparseness);
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
					htmlString = "<b>" + fighter.name + "</b>";
					htmlString += "<hr>";
					htmlString += fighter.wClass;
					htmlString += "<br>";
					htmlString += inchesToHeightStr(fighter.height) + " " + fighter.weight + " lbs";
					htmlString += "<br>";
					htmlString += fighter.wins + " - " + fighter.losses + " - " + fighter.draws;
					htmlString += "<br>";
					htmlString += "Win %: " + (fighter.winPercent * 100).toFixed(2);

					tooltipFocusId = fighter.id;

					tooltip.html(htmlString);
					placeTooltip(tooltip);
					

					tooltip.transition()
						.duration(100)
						.style("opacity", 1);

					
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
					d3.selectAll(".fighterLabel")
						.transition()
						.duration(100)
						.style("opacity", function(d) {
							for(var i = 0; i < fighter.fightList.length; i++) {
								var opponentId = fighter.fightList[i].opponentId;

								if (opponentId === d.id) {
									return 1
								}
							}
							
							return 0;
						})
				})
				.on("mouseout", function(fighter) {
					// hide tooltip
					tooltip.transition()
						.duration(100)
						.style("opacity", 0);

					tooltipFocusId = "";
					
					// restore opacity of non-connected fighters and links
					d3.selectAll(".node circle")
						.transition()
						.duration(100)
						.style("opacity", 1)

					d3.selectAll(".link line")
						.transition()
						.duration(100)
						.style("opacity", function(d) {
							return d.defaultOpacity;
						})

					// hide all fighter labels
					d3.selectAll(".fighterLabel")
						.transition()
						.duration(100)
						.style("opacity", 0)
				})

			d3nodes.append("text")
				.text(function(d) { return d.name })
				.attr("font-family", "Arial")
				.attr("text-anchor", "middle")
				.attr("class", "fighterLabel")
				.attr("opacity", 0)
				.attr("font-size", 12)

			function ticked() {
				function clampX(value) { return Math.min(Math.max(value, 50), width - 50); }
				function clampY(value) { return Math.min(Math.max(value, labelMargin), height - 50); }
				
				d3nodes.selectAll("circle")
					.attr("cx", function(d) { return clampX(d.x); })
					.attr("cy", function(d) { return clampY(d.y); });

				d3nodes.selectAll(".fighterLabel")
					.attr("x", function(d) { return clampX(d.x); })
					.attr("y", function(d, _, textNodeList) {
						var circle = getSvgCircleForFighter(d.id);
						var radius = circle.attr("r");
						var textHeight = textNodeList[0].getBBox().height;
						return clampY(d.y) + textHeight + parseFloat(radius);
					});

				d3links
					.attr("x1", function(d) { return clampX(d.source.x); })
					.attr("y1", function(d) { return clampY(d.source.y); })
					.attr("x2", function(d) { return clampX(d.target.x); })
					.attr("y2", function(d) { return clampY(d.target.y); });

				if(tooltipFocusId !== "") {
					placeTooltip(tooltip);
				}
			}

			// Create weight class labels
			for(var i = 0; i < weightClasses.length; i++) {
				var wClass = weightClasses[i];
				
				svg.append("text")
					.attr("x", getXForWeightClass(wClass, weightClasses))
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
								return color(i);
							}
							else {
								return "#aaaaaa";
							}
						}
					})(wClass))
					.attr("font-family", "Arial")
					.attr("cursor", "pointer")
					.text(wClass)
					.on("mousemove", (function(closureValue) {
						return function() {
							var htmlString = weightDescriptions[closureValue] + "<br>" + countPerWeightClass[closureValue] + " fighters";
							
							tooltip.transition()
								.duration(100)
								.style("opacity", 1);

							tooltip.html(htmlString)
								.style("left", (d3.event.pageX) + "px")
								.style("top", (d3.event.pageY + 20) + "px")
								.style("transform", "translate(" +
									   (-(getToolTipWidth() / 2) + 6) + "px," + // + small, arbitrary amount to make it appear centered under the hand cursor
									   "0px)");

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
					})
					.on("click", (function(closureValue) {
						return function() {
							// toggle
							selectedWeightClasses[closureValue] = !selectedWeightClasses[closureValue];

							regenerateInfoViz(getSelectedWeightClasses(), null, null);
						}
					})(wClass));
			}
		}

		createInfoViz(getSelectedWeightClasses(), null, null);
	});
});
