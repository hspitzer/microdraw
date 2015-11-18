var	debug=true;

var dbroot="./php/interact.php";
var imageInfo = {}; // contains information about the images defined in the json (indiced by name). Filled on initialization. 
                    // Also holds the regions that are defined on each overlay and the indices of the overlays 
var currentImage = undefined;   // name of the current image
var prevImage = undefined;  // name of the last image
var Regions=[]; 	// main list of regions. Contains a paper.js path, a unique ID and a name;
var region=null;	// currently selected region (one element of Regions[])
var handle;			// currently selected control point or handle (if any)
var newRegionFlag;	
var drawingPolygonFlag;
var selectedTool;	// currently selected tool
var viewer;			// open seadragon viewer
var navEnabled=true;// flag indicating whether the navigator is enabled (if it's not, the annotation tools are)
var magicV=10000;	// resolution of the annotation canvas - ATTENTION: is set on initialization to size of image
var myOrigin={};	// Origin identification for DB storage
var	params;			// URL parameters
var	myIP;			// user's IP
var predictionTiles = undefined; //points to tiledImage containing predictions if loaded
var maskTiles = undefined;
var currentPredictionSourceIndex = undefined;
/*
	Region handling functions
*/
function newRegion(arg) {
	if(debug) console.log("> newRegion");
	
	var reg={};
	
	reg.uid=regionUniqueID();
	if(arg.name)
		reg.name=arg.name;
	else {
		reg.name="Untitled "+reg.uid;
	}
	var color=regionHashColor(reg.name);
	
	if(arg.path) {
		reg.path = arg.path;
		reg.path.strokeWidth=arg.path.strokeWidth ? arg.path.strokeWidth : 1;
		reg.path.strokeColor=arg.path.strokeColor ? arg.path.strokeColor : 'black';
		reg.path.strokeScaling=false;
		reg.path.fillColor = arg.path.fillColor ? arg.path.fillColor : 'rgba('+color.red+','+color.green+','+color.blue+',0.5)';
                reg.path.selected=false;
	}
	
	// append region tag to regionList
	var el=$(regionTag(reg.name,reg.uid));
	$("#regionList").append(el);
	
	// handle single click on computers
	el.click(singlePressOnRegion);
	
	// handle double click on computers
	el.dblclick(doublePressOnRegion);

        // when the region name span is unfocused, save the currently entered name as region name
        el.find(".region-name").on("blur", unfocusRegion);

	// handle single and double tap on touch devices
	/*
		RT: it seems that a click event is also fired on touch devices,
		making this one redundant
	*/
	el.on("touchstart",handleRegionTap);

	// push the new region to the Regions array
	Regions.push(reg);
	return reg;
}
function removeRegion(reg) {
	if(debug) console.log("> removeRegion");
	
	// remove from Regions array
	Regions.splice(Regions.indexOf(reg),1);
	// remove from paths
	reg.path.remove();
	// remove from regionList
	var	tag=$("#regionList > .region-tag#"+reg.uid);
	$(tag).remove();
}
function selectRegion(reg) {
	if(debug) console.log("> selectRegion");
	
	var	i;

	// Select path
	for(i=0;i<Regions.length;i++) {
		if(Regions[i]==reg) {
			reg.path.selected=true;
			reg.path.fullySelected=true;
			region=reg;
		}
		else {
			Regions[i].selected=false;
			Regions[i].path.fullySelected=false;
		}
	}
	paper.view.draw();
	
	// Select region name in list
	$("#regionList > .region-tag").each(function(i){
		$(this).addClass("deselected");
		$(this).removeClass("selected");
	});

	var	tag=$("#regionList > .region-tag#"+reg.uid);
	$(tag).removeClass("deselected");
	$(tag).addClass("selected");
	
	if(debug) console.log("< selectRegion");
}
function findRegionByUID(uid) {
	if(debug) console.log("> findRegionByUID");
	
	var	i;
	for(i=0;i<Regions.length;i++) {
		if(Regions[i].uid==uid) {
			return Regions[i];
		}
	}
	console.log("Region with unique ID "+uid+" not found");
	return null;
}
var counter=1;
function regionUniqueID() {
	if(debug) console.log("> regionUniqueID");
	
	var i;
	var	found=false;
	while(found==false) {
		found=true;
		for(i=0;i<Regions.length;i++) {
			if(Regions[i].uid==counter) {
				counter++;
				found=false;
				break;
			}
		}
	}
	return counter;
}

function regionHashColor(name) {
	if(debug) console.log("> regionHashColor");
	
	var color={};
	var hash=name.split("").reduce(function(a,b){
		a=((a<<5)-a)+b.charCodeAt(0);return a&a
	},0);

	// add some randomness
    hash=Math.sin(hash++)*10000;
    hash=0xffffff*(hash-Math.floor(hash));
	
	color.red=hash&0xff;
	color.green=(hash&0xff00)>>8;
	color.blue=(hash&0xff0000)>>16;
	return color;
}
function regionTag(name,uid) {
	if(debug) console.log("> regionTag");
	
	var color=regionHashColor(name);
	var	str;
	if(uid)
		str=[	"<div class='region-tag' id='"+uid+"' style='padding:2px'>",
				"<div class='region-color'",
				"style='background-color:rgba(",
				color.red,",",color.green,",",color.blue,",0.67",
				")'></div>",
				"<span class='region-name'>"+name+"</span>",
				"</div>",
				].join(" ");
	else
		str=[	"<div class='region-tag' style='padding:2px'>",
				"<div class='region-color'",
				"style='background-color:rgba(",
				color.red,",",color.green,",",color.blue,",0.67",
				")'></div>",
				"<span class='region-name'>"+name+"</span>",
				"</div>",
				].join(" ");
	return str;
}


function fillRegionList() {
    if (debug) console.log('> fillRegionList');
    for (var i = 0; i < Regions.length; i++) {
        var reg = Regions[i];
        // append region tag to regionList
        var el=$(regionTag(reg.name,reg.uid));
        $("#regionList").append(el);

	// handle single click on computers
	el.click(singlePressOnRegion);
	
	// handle double click on computers
	el.dblclick(doublePressOnRegion);

        // when the region name span is unfocused, save the currently entered name as region name
        el.find(".region-name").on("blur", unfocusRegion);

	// handle single and double tap on touch devices
	/*
		RT: it seems that a click event is also fired on touch devices,
		making this one redundant
	*/
	el.on("touchstart",handleRegionTap);

    }

}
function emptyRegionList() {
    if (debug) console.log('> emptyRegionList');
    for (var i = 0; i < Regions.length; i++) {
        var reg = Regions[i];
        var	tag=$("#regionList > .region-tag#"+reg.uid);
	$(tag).remove();
    }
}

function appendRegionTagsFromOntology(o) {
	if(debug) console.log("> appendRegionTagsFromOntology");
	
	for(var i=0;i<o.length;i++) {
		if(o[i].parts) {
			$("#regionPicker").append("<div>"+o[i].name+"</div>");
			appendRegionTagsFromOntology(o[i].parts);
		}
		else {
			var tag=regionTag(o[i].name);
			var	el=$(tag).addClass("ontology");
			$("#regionPicker").append(el);

			// handle single click on computers
			el.click(singlePressOnRegion);
	
			// handle double click on computers
			el.dblclick(doublePressOnRegion);

			el.on("touchstart",handleRegionTap);
		}
	}
}
function regionPicker(parent) {
	if(debug) console.log("> regionPicker");
	
	$("div#regionPicker").appendTo("body");
	$("div#regionPicker").show();
}

function changeRegionName(reg,name) {
	if(debug) console.log("> changeRegionName");
	
	var i;
	var color=regionHashColor(name);
        var alpha=reg.path.fillColor.alpha;

        // Update path
	reg.name=name;
	reg.path.fillColor='rgba('+color.red+','+color.green+','+color.blue+','+alpha+')';
	paper.view.draw();
	
	// Update region tag
	$(".region-tag#"+reg.uid+">.region-name").text(name);
	$(".region-tag#"+reg.uid+">.region-color").css('background-color','rgba('+color.red+','+color.green+','+color.blue+',0.67)');
}

/*
	Interaction: mouse and tap
*/
function clickHandler(event){
	if(debug) console.log("> clickHandler");

	event.stopHandlers=!navEnabled;
}
function pressHandler(event){
	if(debug) console.log("> pressHandler");

	if(!navEnabled) {
		event.stopHandlers = true;
		mouseDown(event.originalEvent.layerX,event.originalEvent.layerY);
	}
}
function dragHandler(event){
	if(debug) console.log("> dragHandler");

	if(!navEnabled) {
		event.stopHandlers = true;
		mouseDrag(event.originalEvent.layerX,event.originalEvent.layerY);
	}
}
function dragEndHandler(event){
	if(debug) console.log("> dragEndHandler");

	if(!navEnabled) {
		event.stopHandlers = true;
		mouseUp();
	}
}
function singlePressOnRegion(event) {
	if(debug) console.log("> singlePressOnRegion");
	
	event.stopPropagation();
	event.preventDefault();

	var	el=$(this);
	var	uid;
	var	reg;
	
	if(el.hasClass("ontology")) {
		// Click on regionPicker (ontology selection list)
		var newName=el.find(".region-name").text();
		uid=$(".region-tag.selected").attr('id');
		reg=findRegionByUID(uid);
		changeRegionName(reg,newName);
		$("div#regionPicker").appendTo($("body")).hide();
	}
	else {
		// Click on regionList (list or annotated regions)
		uid=$(this).attr('id');
		reg=findRegionByUID(uid);
		if(reg)
			selectRegion(reg);
		else
			console.log("region undefined");
	}
}
function doublePressOnRegion(event) {
	if(debug) console.log("> doublePressOnRegion");
	
	event.stopPropagation();
	event.preventDefault();

	$(this).find(".region-name").attr('contentEditable' ,true);
        
	//regionPicker(this);
}

function unfocusRegion(event){
        if (debug) console.log('> unfocusRegion');
        var newName = $(this).text();
        uid=$(".region-tag.selected").attr('id');
        reg=findRegionByUID(uid);
        changeRegionName(reg,newName);
        $(this).attr('contentEditable' ,false);
        
}

var tap=false
function handleRegionTap(event) {
/*
	Handles single and double tap in touch devices
*/
	if(debug) console.log("> handleRegionTap");

	var	caller=this;
	
	if(!tap){ //if tap is not set, set up single tap
		tap=setTimeout(function(){
			tap=null
		},300);
		
		// call singlePressOnRegion(event) using 'this' as context
		singlePressOnRegion.call(this,event);
	} else {
		clearTimeout(tap);
		tap=null;
		
		// call doublePressOnRegion(event) using 'this' as context
		doublePressOnRegion.call(this,event);
	}
	if(debug) console.log("< handleRegionTap");
}
function mouseDown(x,y) {
	if(debug) console.log("> mouseDown");
	
	var prevRegion=null;
        console.log(x + ' ' + y);
	var point=paper.view.viewToProject(new paper.Point(x,y));
        console.log(point);
	handle=null;

	switch(selectedTool) {
		case "select":
		case "addpoint":
		case "delpoint":
		case "addregion":
		case "delregion":
		case "splitregion":
			var hitResult=paper.project.hitTest(point, {
					tolerance:10,
					stroke: true,
					segments:true,
					fill: true,
					handles:true
				});
			newRegionFlag=false;

			if (hitResult) {
				var i;
				for(i=0;i<Regions.length;i++) {
					if(Regions[i].path==hitResult.item) {
						re=Regions[i];
						break;
					}
				}

				// select path
				if(region && region!=re) {
					region.path.selected=false;
					prevRegion=region;
				}
				selectRegion(re);
				//re.path.fullySelected=true;
				//region=re;
		
				if (hitResult.type == 'handle-in') {
					handle = hitResult.segment.handleIn;
					handle.point=point;
				} else
				if (hitResult.type == 'handle-out') {
					handle = hitResult.segment.handleOut;
					handle.point=point;
				} else
				if (hitResult.type=='segment') {
					if(selectedTool=="select") {
						handle=hitResult.segment.point;
						handle.point=point;
					}
					if(selectedTool=="delpoint")
						hitResult.segment.remove();
				} else
				if (hitResult.type=='stroke' && selectedTool=="addpoint") {
					region.path
					.curves[hitResult.location.index]
					.divide(hitResult.location);
					region.path.fullySelected=true;
					paper.view.draw();
				} else
				if (selectedTool=="addregion") {
					if(prevRegion) {
						var newPath=region.path.unite(prevRegion.path);
						removeRegion(prevRegion);
						region.path.remove();
						region.path=newPath;
					}
				} else
				if (selectedTool=="delregion") {
					if(prevRegion) {
						var newPath=prevRegion.path.subtract(region.path);
       						removeRegion(prevRegion);
						prevRegion.path.remove();
						newRegion({path:newPath});
					}
				} else
				if (selectedTool=="splitregion") {
					if(prevRegion) {
						var newPath=region.path.divide(prevRegion.path);
						removeRegion(prevRegion);
						region.path.remove();
						region.path=newPath;
						for(i=0;i<newPath._children.length;i++)
						{
							if(i==0)
								region.path=newPath._children[i];
							else {
								newRegion({path:newPath._children[i]});
							}
						}
					}
				}
				break;
			}
			if(hitResult==null && region) {
				// deselect paths
				region.path.selected=false;
				region=null;
			}
			break;
		case "draw":
			// Start a new region
			// if there was an older region selected, unselect it
			if(region)
				region.path.selected = false;
			// start a new region
			region=newRegion({path:new paper.Path({segments:[point]})});
			// signal that a new region has been created for drawing
			newRegionFlag=true;
			break;
                case "draw-polygon":
                        console.log(drawingPolygonFlag);
                        // is already drawing a polygon or not?
                        if(drawingPolygonFlag != true) {
                            //deselect previously selected region
                            if(region)
                                region.path.selected = false;
                            // Start a new Region with no fill color
                            region=newRegion({path:new paper.Path({segments:[point]})});
                            region.path.fillColor.alpha=0;
                            drawingPolygonFlag=true;
                            region.path.selected = true;
                        } else {
                            var hitResult=paper.project.hitTest(point, {tolerance:10, segments:true});
                            if (hitResult) {
                                console.log(hitResult);
                                console.log(region.path);
                            }
                            if (hitResult && hitResult.item == region.path && hitResult.segment.point == region.path.segments[0].point) {
                                // clicked on first point of current path
                                // --> close path and remove drawing flag
                                finishDrawingPolygon(true);
                                
                            } else { 
                                // add point to region
                                region.path.add(point);
                            }
                        }
	}
	paper.view.draw();
}
function mouseDrag(x,y) {
	if(debug) console.log("> mouseDrag");

	var point=paper.view.viewToProject(new paper.Point(x,y));
	if (handle) {
		handle.x+=point.x-handle.point.x;
		handle.y+=point.y-handle.point.y;
		handle.point=point;
	} else
	if(selectedTool=="draw") {
		region.path.add(point);
	}
	paper.view.draw();
}
function mouseUp() {
	if(debug) console.log("> mouseUp");

	if(newRegionFlag==true){
		region.path.simplify(500);
		region.path.closed=true;
		region.path.fullySelected = true;
	}
	paper.view.draw();
}

/*
        Drawing helper functions
*/

function togglePathColor() {
        if(debug) console.log("> togglePathColor");

        if (region) {
            var col = region.path.strokeColor;
            if (col.equals('black')) 
                region.path.strokeColor = 'white'
            else if (col.equals('white'))
                region.path.strokeColor = 'yellow';
            else
                region.path.strokeColor= 'black';
            paper.view.draw();
        }
}

function toggleRegionColor() {
        if (debug) console.log("> toggleRegionColor");

        if (region) {
            region.path.fillColor.alpha = (region.path.fillColor.alpha == 0) ? 0.5 : 0;
            paper.view.draw(); 
        }
            
}

function togglePathWidth() {
        if (debug) console.log("> togglePathWidth");

        if (region) {
            region.path.strokeWidth = (region.path.strokeWidth) % 3 + 1;
            paper.view.draw();
        }

}


function finishDrawingPolygon(closed){
        // finished the drawing of the polygon
        if (closed==true) {
            region.path.closed = true;
            region.path.fillColor.alpha = 0.5;
        }
        region.path.fullySelected = true;
        region.path.smooth();
        drawingPolygonFlag = false;
}

/*
	Tool selection
*/
function backToPreviousTool(prevTool) {
	setTimeout(function() {
		selectedTool=prevTool;
		selectTool()
	},500);
}
function toolSelection(event) {
	if(debug) console.log("> toolSelection");

        //end drawing of polygons and make open form
        if (drawingPolygonFlag == true)
            finishDrawingPolygon(false);

	var prevTool=selectedTool;
	selectedTool=$(this).attr("id");
	selectTool();
	
	switch(selectedTool) {
		case "select":
		case "addregion":
		case "delregion":
		case "addpoint":
		case "delpoint":
		case "draw":
                case "draw-polygon":
			navEnabled=false;
			break;
		case "zoom":
			navEnabled=true;
			handle=null;
			break;
		case "delete":
			for(i in Regions) {
				if(Regions[i].path.selected) {
					removeRegion(Regions[i]);
					paper.view.draw();
					break;
				}
			}
			backToPreviousTool(prevTool);
			break;
		case "save":
			interactSave();
			backToPreviousTool(prevTool);
			break;
                case "save-svg":
                        interactSaveSVG();
                        backToPreviousTool(prevTool);
                        break;
                case "load":
                        interactLoadFromUser();
                        backToPreviousTool(prevTool);
                        break;
                case "toggle-mask":
                        addOpaqueMaskTiles();
                        backToPreviousTool(prevTool);
                        break;
                case "color-line":
                        togglePathColor();
                        backToPreviousTool(prevTool);
                        break;
                case "color-region":
                        toggleRegionColor();
                        backToPreviousTool(prevTool);
                        break;
                case "width":
                        togglePathWidth();
                        backToPreviousTool(prevTool);
                        break;
		case "zoom-in":
		case "zoom-out":
		case "home":
			backToPreviousTool(prevTool);
			break;
                case "prev":
                        loadPreviousImage();
                        backToPreviousTool(prevTool);
                        break;
                case "next":
                        loadNextImage();
                        backToPreviousTool(prevTool);
                        break;
	}
}
function selectTool() {
	if(debug) console.log("> selectTool");
	
	$("img.button").removeClass("selected");
	$("img.button#"+selectedTool).addClass("selected");
	//$("svg").resource=dzi_files/test.jsonmoveClass("selected");
	//$("svg#"+selectedTool).addClass("selected");
}

/*
	Annotation storage
*/
/* Save Overlay to SVG Image */
function interactSaveSVG() {
       
        //set SVG size, scale and transform parameters such that they fit to the original image resolution
        //paper.view.draw();
        var svg = paper.project.exportSVG({asString: false});
        //scale of the paper canvas coordinates to the real image coordinates
        //var scale = parseFloat(imageSize.Width.nodeValue) / magicV;
        svg.setAttribute("width", viewer.world.getItemAt(0).getContentSize().x);
        svg.setAttribute("height", viewer.world.getItemAt(0).getContentSize().y);
        svg.firstChild.setAttribute("transform", "translate(0,0) scale(1,1)");

        var svg_string = (new XMLSerializer).serializeToString(svg);
        var blob = new Blob([svg_string], {type: "image/svg+xml;charset=utf8"});
        saveAs(blob, params.source.split('.')[0] + '_' + currentImage + '_annotated.svg');

}

/* Interact push/pull */
function interactSave() {
/*
	Save SVG overlay to Interact DB
*/
	if(debug) console.log("> save promise");
	var i;
	var	key;
	var value;
	var el;
	var origin;

	// key
	key="regionPaths";
	
	// configure value to be saved
	value={};
	value.Regions=[];
	for(i=0;i<Regions.length;i++)
	{
		el={};
		el.path=JSON.parse(Regions[i].path.exportJSON());
		el.name=Regions[i].name;
		value.Regions.push(el);
	}
	
	return $.ajax({
		url:dbroot,
		type:"POST",
		data:{
			"action":"save",
			"origin":JSON.stringify(myOrigin),
			"key":key,
			"value":JSON.stringify(value)
		},
		success: function(data) {
			console.log("< interactSave resolve: Successfully saved regions:",Regions.length);
		},
		error: function(jqXHR, textStatus, errorThrown) {
			console.log("< interactSave resolve: ERROR: " + textStatus + " " + errorThrown);
		}
	});
}

function interactLoadFromUser() {
/* 
 *  Ask for a username and load annotations of this username
 */
    
    if (debug) console.log("> interactLoadFromUser promise");

    var user = prompt("Please enter the username", "d.stibane");
    if (user != null) {
        var origin = {};
        origin.appName = myOrigin.appName;
        origin.source= myOrigin.source;
        origin.user = user;
        interactLoad(origin);
    }

}


function interactLoad(origin) {
/*
	Load SVG overlay from Interact DB
*/
	if(debug) console.log("> interactLoad promise");
	
        var ori = typeof origin !== 'undefined' ? origin : myOrigin

	var	def=$.Deferred();
	var	key="regionPaths";
	
	$.get(dbroot,{
		"action":"load_last",
		"origin":JSON.stringify(ori),
		"key":key
	}).success(function(data) {
		var	i,obj,reg;
		$("#regionList").html("");
		obj=JSON.parse(data);
		if(obj) {
			obj=JSON.parse(obj.myValue);
			for(i=0;i<obj.Regions.length;i++) {
				var reg={};
				var	json;
				reg.name=obj.Regions[i].name;
				json=obj.Regions[i].path;
				reg.path=new paper.Path();
				reg.path.importJSON(json);
				newRegion({name:reg.name,path:reg.path});
			}
			paper.view.draw();
		}
		if(debug) console.log("< interactLoad resolve success. Number of regions:", Regions.length);
		def.resolve();
	}).error(function(jqXHR, textStatus, errorThrown) {
        console.log("< interactLoad resolve ERROR: " + textStatus + " " + errorThrown);
    });
    
    return def.promise();
}
function interactIP() {
/*
	Get my IP
*/
	if(debug) console.log("> interactIP promise");

	$("#regionList").html("<br />Connecting to database...");
	return $.get(dbroot,{
		"action":"remote_address"
	}).success(function(data) {
		if(debug) console.log("< interactIP resolve: success");
		myIP=data;
	}).error(function(jqXHR, textStatus, errorThrown) {
        console.log("< interactIP resolve: ERROR, "+textStatus+", "+errorThrown);
		$("#regionList").html("<br />Error: Unable to connect to database.");
    });
}

function save() {
	if(debug) console.log("> save");
	
	var i;
	var obj;
	var el;

	obj={};
	obj.Regions=[];
	for(i=0;i<Regions.length;i++)
	{
		el={};
		el.path=Regions[i].path.exportJSON();
		el.name=Regions[i].name;
		obj.Regions.push(el);
	}
	localStorage.Microdraw=JSON.stringify(obj);

	if(debug) console.log("+ saved regions:",Regions.length);
}
function load() {
	if(debug) console.log("> load");
	var	i,obj,reg;
	if(localStorage.Microdraw) {
		console.log("Loading data from localStorage");
		obj=JSON.parse(localStorage.Microdraw);
		for(i=0;i<obj.Regions.length;i++) {
			var reg={};
			var	json;
			reg.name=obj.Regions[i].name;
			json=obj.Regions[i].path;
			reg.path=new paper.Path();
			reg.path.importJSON(json);
			newRegion({name:reg.name,path:reg.path});
		}
		paper.view.draw();
	}
}

/*
	Initialisation
*/
function resizeAnnotationOverlay() {
	if(debug) console.log("> resizeAnnotationOverlay");
	
	var width=$("body").width();
	var height=$("body").height();
        
        //console.log('container size ' + viewer.viewport.getContainerSize());
	$("canvas.overlay").width(width);
	$("canvas.overlay").height(height);
	paper.view.viewSize=[width,height];
}

function loadImageEvent() {
    if (debug) console.log("> loadImageEvent");
    name = $("#slice-name").val();
    if (name in imageInfo) {
        loadImage(name);
    }
    else {
        // reset text in input field
        $("#slice-name").val(currentImage);

    }
}

function loadImage(name) {
    if (debug) console.log("> loadImage(" + name + ")");
    // save previous image for some (later) cleanup
    prevImage = currentImage;
    
    // remove prediction and mask tiles
    if (predictionTiles != undefined) {
        viewer.world.removeItem(predictionTiles);
        predictionTiles = undefined;
    }
    if (maskTiles != undefined) {
        viewer.world.removeItem(maskTiles);
        maskTiles = undefined;
    }

    // set current image to new image
    currentImage = name;

    viewer.open({"tileSource": imageInfo[currentImage]["source"]});

}

function loadNextImage() {
    if (debug) console.log("> loadNextImage");
    var index = imageOrder.indexOf(currentImage);
    var nextIndex = ((index +1 < imageOrder.length)? index+1 : 0);

    // update image slider
    update_slider_value(nextIndex);

    loadImage(imageOrder[nextIndex]);

}

function loadPreviousImage() {
    console.log("> loadPrevImage");
    var index = imageOrder.indexOf(currentImage);
    var previousIndex = ((index - 1 >= 0)? index-1 : imageOrder.length -1 );

    // update image slider
    update_slider_value(previousIndex);

    loadImage(imageOrder[previousIndex]);
}


function initAnnotationOverlay(data) {
	if(debug) console.log("> initAnnotationOverlay");
        console.log('new overlay size' + viewer.world.getItemAt(0).getContentSize());
        // save regions 
        if (prevImage != undefined) {
            imageInfo[prevImage]["Regions"] = Regions;
        }

        // set up regions for new canvas
        emptyRegionList();
        Regions = imageInfo[currentImage]["Regions"];      
        fillRegionList();

        // create canvas if needed and do general canvas set up
        var newCanvas = false;
        if (document.getElementById(currentImage) == null) {
	    // set up vectorial annotation overlay
	    $("body").append("<canvas class='overlay' id='" + currentImage + "'></canvas>");
            newCanvas = true;
        }

	var width=$("body").width();
	var height=$("body").height();
        $("canvas.overlay").attr('width',width);
	$("canvas.overlay").attr('height',height);
	var canvas=document.getElementById(currentImage);

        // turn current project invisible
        if (paper.project != null)
            paper.project.activeLayer.visible = false;
        if (imageInfo[currentImage]["projectID"] == undefined) {
            // for this canvas no project exists: create it!
            paper.setup(canvas);
            imageInfo[currentImage]["projectID"] = paper.project.index;
            if (debug) console.log('Set up new project with ID ' + imageInfo[currentImage]["projectID"]);
        } else {
            paper.projects[imageInfo[currentImage]["projectID"]].activate();
        }
        // turn new project visible
        paper.project.activeLayer.visible = true;

        // resize view to correct size
        paper.view.viewSize=[width, height];
	paper.settings.handleSize=10;
	
        // change myOrigin 
        myOrigin.source = myOrigin.source.split('@')[0] + '@' + currentImage;

	if (newCanvas) {
            interactLoad().then(function(){
		$("#regionList").height($(window).height()-$("#regionList").offset().top);
	    });
        }

        
        // set size of the current overlay to match the size of the current image (assuming that the first image in the world is the dzi image)
        magicV = viewer.world.getItemAt(0).getContentSize().x;
        // moved adding handler to general initMicrodraw, because here we add one handler per page change
        //viewer.addHandler('animation', function(event){
    	//	transform()
	//});
	transform();

}

function transform() {
	if(debug) console.log("> transform");

	var z=viewer.viewport.viewportToImageZoom(viewer.viewport.getZoom(true));
	var sw=viewer.source.width;
	var bounds=viewer.viewport.getBounds(true);
        var x=magicV*bounds.x;
        var y=magicV*bounds.y;
        var w=magicV*bounds.width;
        var h=magicV*bounds.height;
        paper.view.setCenter(x+w/2,y+h/2);
        paper.view.zoom=(sw*z)/magicV;
}
function deparam() {
	if(debug) console.log("> deparam");

	var search = location.search.substring(1);
	return search?JSON.parse('{"' + search.replace(/&/g, '","').replace(/=/g,'":"') + '"}',
					 function(key, value) { return key===""?value:decodeURIComponent(value) }):{}	
}
function loginChanged() {
	if(debug) console.log("> loginChanged");

	updateUser();
}
function updateUser() {
	if(debug) console.log("> updateUser");

	if(MyLoginWidget.username)
		myOrigin.user=MyLoginWidget.username;
	else {
		var username={};
		username.IP=myIP;
		username.hash=navigator.userAgent.split("").reduce(function(a,b){
			a=((a<<5)-a)+b.charCodeAt(0);return a&a
		},0).toString(16);
		myOrigin.user=username;
	}
}
function makeSVGInline() {
	if(debug) console.log("> makeSVGInline promise");

	var def=$.Deferred();
	$('img.button').each(function(){
		var $img = $(this);
		var imgID = $img.attr('id');
		var imgClass = $img.attr('class');
		var imgURL = $img.attr('src');

		$.get(imgURL, function(data) {
			// Get the SVG tag, ignore the rest
			var $svg = $(data).find('svg');

			// Add replaced image's ID to the new SVG
			if(typeof imgID !== 'undefined') {
				$svg = $svg.attr('id', imgID);
			}
			// Add replaced image's classes to the new SVG
			if(typeof imgClass !== 'undefined') {
				$svg = $svg.attr('class', imgClass+' replaced-svg');
			}

			// Remove any invalid XML tags as per http://validator.w3.org
			$svg = $svg.removeAttr('xmlns:a');

			// Replace image with new SVG
			$img.replaceWith($svg);
			
			if(debug) console.log("< makeSVGInline resolve: success");
			def.resolve();
		}, 'xml');
	});
	
	return def.promise();
}

function updateSliceName() {
    $("#slice-name").val(currentImage);
}
/*
 * Mask and prediction overlays
 */

function addOpaqueMaskTiles() {
        if (debug) console.log("> addOpaqueMaskTiles promise");
        var tiles;
        var source;
        if (imageInfo[currentImage]["maskSource"] == undefined) {
            alert("No mask available")
        }
        else {
            if (maskTiles == undefined) {
                // add tiled image 
                if (debug) console.log('adding mask');
                
                var func = function(data) {
                    if (debug) console.log("added Tiled Image to world");
                    maskTiles = data.item;
                    console.log(viewer);
                    viewer.world.removeHandler('add-item', func);

                };
                viewer.world.addHandler('add-item', func);             
                viewer.addTiledImage({tileSource: imageInfo[currentImage]["maskSource"], opacity:0.5});
           }
           else {
               if (debug) console.log('removing mask');
               viewer.world.removeItem(maskTiles);
               maskTiles = undefined;
           }  
        }
}

function fillPredictionSelect() {
    if (debug) console.log('> fillPredictionSelect');
    // delete all entries from predictions select
    $("#predictions").empty();

    // fill predictions select with values
    var sel = $("#predictions"); //document.getElementById('predictions');
    sel.append("<option value='none'>No Predictions</option>");
    for (var i = 0; i < imageInfo[currentImage]["predictionSources"].length; i++) {
        var source = imageInfo[currentImage]["predictionSources"][i];
        var opt = "<option id='" + i + "' value='" + source + "'>" + source + "</option>";
        sel.append(opt);
    }

}

function addOpaquePredictionTiles(event) {
        if (debug) console.log("> addOpaquePredictionTiles promise");
        var name = $("#predictions").val();
        if (predictionTiles != undefined) {
            // remove old tiles 
            viewer.world.removeItem(predictionTiles);
            predictionTiles = undefined;
        }
        if (name != "none") {
            // add new tiles
            var func = function(data) {
                if (debug) console.log("added Tiled Image to world");
                predictionTiles = data.item;
                viewer.world.removeHandler('add-item', func);
            };
            viewer.world.addHandler('add-item', func);
            viewer.addTiledImage({tileSource: name, opacity:0.5});
        }

}

function initSlider(min_val, max_val, step, default_value) {
/*
    Initializes a slider to easily change between slices
*/
    if (debug) console.log("> initSlider promise");
	var slider = $("#slider");
	if (slider.length > 0) { // only if slider could be found
	    slider.attr("min", min_val);
	    slider.attr("max", max_val-1);
	    slider.attr("step", step);
	    slider.val(default_value);

	    slider.on("change", function() {
	        slider_onchange(this.value);
	    });

	    slider.on("input", function() {
	        slider_onchange(this.value);
	    });
	}
}

function slider_onchange(newImageIndex) {
/*
    Called when the slider value is changed to load a new slice
*/
    if (debug) console.log("> slider_onchange promise");
	var imageNumber = imageOrder[newImageIndex];
    loadImage(imageNumber);
}

function update_slider_value(newIndex) {
/*
    Used to update the slider value if the slice was changed by another control
*/
    if (debug) console.log("> update_slider_value promise");
    var slider = $("#slider");
	if (slider.length > 0) { // only if slider could be found
	    slider.val(newIndex);
	}
}

function mousewheel_eventhandler(event) {
/*
    Eventhandler to change between slices by mousewheel
*/
    if (debug) console.log("> mousewheel_eventhandler promise");
    if(event.originalEvent.wheelDelta < 0 || event.originalEvent.detail > 0) {
       //scroll down
       loadPreviousImage();
    }
    else {
       //scroll up
       loadNextImage();
    }

    //prevent page fom scrolling
    return false;
}

function find_slice_number(number_str) {
/*
    Searches for the given slice-number.
    If the number could be found its index will be returned. Otherwise -1
*/
    var number = parseInt(number_str); // number = NaN if cast to int failed!
    if (!isNaN(number)) {
        for(i = 0; i < imageOrder.length; i++)  {
                var slice_number = parseInt(imageOrder[i]);
                // Compare the int values because the string values might be different (e.g. "0001" != "1")
                if(number == slice_number) {
                    return i;
                }
        }
    }

    return -1;
}

function slice_name_onenter(event) {
/*
    Eventhandler to open a specific slice by the enter key
*/
    if (debug) console.log("> slice_name_onenter promise");
    if (event.keyCode == 13) { // enter key
        var slice_number = $(this).val();
        var index = find_slice_number(slice_number);
        if(index > -1) { // if slice number exists
            update_slider_value(index);
            loadImage(imageOrder[index]);
        }
    }
    event.preventDefault(); // prevent the default action (scroll / move caret)
}

function keydown_eventhandler(event) {
/*
    Eventhandler to change between slices by arrow keys
*/
    if (debug) console.log("> keydown_eventhandler promise");
    switch(event.which) {
            case 37: // left arrow
    	        loadPreviousImage();
                break;
            case 39: // right arrow
    	        loadNextImage();
                break;
            default:
                return; // exit this handler for other keys
    }
    event.preventDefault(); // prevent the default action (scroll / move caret)
}

function init_slice_datalist(data) {
/*
    Inits a datalist with all known slice numbers.
*/
    var options = "";
    for(i = 0; i < data.length; i++)  {
        options += "<option value=\"" + data[i] + "\" />";
    }

    // Append options to datalist
    $("#slice-names").append(options);
}

function initMicrodraw() {
	if(debug) console.log("> initMicrodraw promise");
	
	var def=$.Deferred();
	
	// Subscribe to login changes
	MyLoginWidget.subscribe(loginChanged);
	
	// Enable click on toolbar buttons
	$("img.button").click(toolSelection);
       	
	// Configure currently selected tool
	selectedTool="zoom";
	selectTool();

    // load tile sources
	$.get(params.source,function(obj) {
        // Init the datalist with all slice numbers
        init_slice_datalist(obj.names);

        // Init slider that can be used to change between slides
        initSlider(0, obj.names.length, 1, 0);

        // update image info with relevant information!
        // create function on any entry with getTileUrl
                imageOrder = []
                for (var i = 0; i < obj.tileSources.length; i++) {
                    if (obj.tileSources[i].getTileUrl != undefined) {
                        eval("obj.tileSources[" + i + "].getTileUrl = " + obj.tileSources[i].getTileUrl);
                    }
                    imageOrder.push(obj.names[i]);
                    imageInfo[obj.names[i]] = {"source": obj.tileSources[i], "Regions": [], "projectID": undefined, "predictionSources":[], "maskSource":undefined};
                }
                for (var key in obj.maskSources) {
                    if (obj.maskSources[key].getTileUrl != undefined) {
                        eval("obj.maskSources[" + key + "].getTileUrl = " + obj.maskSources[key].getTileUrl);
                    }
                    imageInfo[key]["maskSource"] = obj.maskSources[key];
                }
                for (var key in obj.predictionSources) {
                    for (var i = 0; i < obj.predictionSources[key].length; i++) {
                        if (obj.predictionSources[key][i].getTileUrl != undefined) {
                            eval("obj.predictionSources[" + key + "][" + i + "].getTileUrl = " + obj.predictionSources[key][i].getTileUrl);
                        }
                        imageInfo[key]["predictionSources"].push(obj.predictionSources[key][i]);
                    }
                }
                currentImage = obj.names[0];
                console.log(imageInfo);
                console.log(imageOrder);
		params.tileSources=obj.tileSources;
                params.predictionSource = obj.predictionSource;
                params.maskSource = obj.maskSource;
               
                viewer = OpenSeadragon({
			id: "openseadragon1",
			prefixUrl: "lib/openseadragon/images/",
			tileSources: [], // obj.tileSources,
                        //showReferenceStrip: (obj.tileSources.length>1),
	                referenceStripSizeRatio: 0.2,
                        preserveViewport: true,
                        sequenceMode: false,
                        //sequenceMode: (obj.tileSources.length>1 && obj.tileSources[0].opacity == undefined),
			//sequenceControlAnchor:'TOP_LEFT',
                        //referenceStripPosition:'BOTTOM_RIGHT',
                        showNavigator: true,
			navigatorId:"myNavigator",
			zoomInButton:"zoom-in",
			zoomOutButton:"zoom-out",
                        //previousButton: "prev",
                        //nextButton: "next",
			homeButton:"home"
		});
                //viewer.world.addHandler('add-item', function(data) {
                //    if (debug) console.log("added Tiled Image to world");
                //    console.log(data);
                //    imageInfo[currentImage]["tiledImageItem"] = data.item;
                    //predictionTiles = data.item;
                //    viewer.world.removeAllHandlers('add-item');
                //});
                viewer.open({"tileSource": imageInfo[currentImage]["source"]});
            	viewer.scalebar({
			type: OpenSeadragon.ScalebarType.MICROSCOPE,
			minWidth:'150px',
			pixelsPerMeter:obj.pixelsPerMeter,
			color:'black',
			fontColor:'black',
			backgroundColor:"rgba(255,255,255,0.5)",
			barThickness:4,
			location: OpenSeadragon.ScalebarLocation.TOP_RIGHT,
			xOffset:5,
			yOffset:5
		});
		viewer.addHandler('open',initAnnotationOverlay);
                viewer.addHandler('open',fillPredictionSelect);
                viewer.addHandler('open',updateSliceName);
                viewer.addHandler('animation', function(event){transform()});

		//viewer.addHandler("page", function (data) {
		//	console.log(params.tileSources[data.page]);
		//});
                viewer.addViewerInputHook({hooks: [
			{tracker: 'viewer', handler: 'clickHandler', hookHandler: clickHandler},
			{tracker: 'viewer', handler: 'pressHandler', hookHandler: pressHandler},
			{tracker: 'viewer', handler: 'dragHandler', hookHandler: dragHandler},
			{tracker: 'viewer', handler: 'dragEndHandler', hookHandler: dragEndHandler}
		]});

        // add event that triggers the addition of predictions tiles when the dropdown is changed
        $("#predictions").on('change', addOpaquePredictionTiles);

        // add event for chaning the slice name in the input field
        $("#slice-name").on('blur', loadImageEvent);


		if(debug) console.log("< initMicrodraw resolve: success");
		def.resolve();
	});

	// Change slices by arrow keys
    $(document).keydown(keydown_eventhandler);

    // Change slices by mousewheel if the mouse is over the toolbar
    $("#info").on("mousewheel DOMMouseScroll", mousewheel_eventhandler);

    // Change current slice by typing in the slice number and pessing the enter key
    $("#slice-name").keyup(slice_name_onenter);
	
	$(window).resize(function() {
		$("#regionList").height($(window).height()-$("#regionList").offset().top);
		resizeAnnotationOverlay();
	});

        //window.onbeforeunload = function(e) {
        //    return 'Do you really want to close this window?';
        //};
	appendRegionTagsFromOntology(Ontology);

       
	
	//makeSVGInline().then(selectTool());
	
	return def.promise();
}

$.when(
	interactIP(),
        MyLoginWidget.init()
).then(function(){
	params=deparam();
	myOrigin.appName="microdraw";
	myOrigin.source=params.source;
	updateUser();
}).then(initMicrodraw);
/*
	// Log microdraw
	//interactSave(JSON.stringify(myOrigin),"entered",null);

	// load SVG overlay from localStorage
	interactLoad();
	//load();
*/
