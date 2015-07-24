var	debug=true;

var dbroot="./php/interact.php";
var Regions=[]; 	// main list of regions. Contains a paper.js path, a unique ID and a name;
var region=null;	// currently selected region (one element of Regions[])
var handle;			// currently selected control point or handle (if any)
var newRegionFlag;	
var drawingPolygonFlag;
var selectedTool;	// currently selected tool
var viewer;			// open seadragon viewer
var imageSize;          // real size of the opened image openseadragon (openSeadragon.Point)
var navEnabled=true;// flag indicating whether the navigator is enabled (if it's not, the annotation tools are)
var magicV=10000;	// resolution of the annotation canvas
var myOrigin={};	// Origin identification for DB storage
var	params;			// URL parameters
var	myIP;			// user's IP

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
	var point=paper.view.viewToProject(new paper.Point(x,y));
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
					fill: false,
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
                case "color-line":
                        togglePathColor();
                        backToPreviousTool(prevTool);
                        break;
                case "color-region":
                        toggleRegionColor()
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
        var scale = parseFloat(imageSize.Width.nodeValue) / magicV;
        
        svg.setAttribute("width", imageSize.Width.nodeValue);
        svg.setAttribute("height", imageSize.Height.nodeValue);
        svg.firstChild.setAttribute("transform", "translate(0,0) scale(" + scale + "," + scale + ")");

        var svg_string = (new XMLSerializer).serializeToString(svg);
        var blob = new Blob([svg_string], {type: "image/svg+xml;charset=utf8"});
        saveAs(blob, params.source.split('.')[0] + '-annotated.svg');

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

    var user = prompt("Please enter the username", "");
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
function initAnnotationOverlay() {
	if(debug) console.log("> initAnnotationOverlay");
	
	// set up vectorial annotation overlay
	$("body").append("<canvas class='overlay'></canvas>");

	//resizeAnnotationOverlay();

	var width=$("body").width();
	var height=$("body").height();

        $("canvas.overlay").attr('width',width);
	$("canvas.overlay").attr('height',height);

	var	canvas=$("canvas.overlay")[0];
	canvas.className="overlay";

        Regions = []

	paper.setup(canvas);
	paper.settings.handleSize=10;
	
	interactLoad().then(function(){
		$("#regionList").height($(window).height()-$("#regionList").offset().top);
	});
	
	viewer.addHandler('animation', function(event){
		transform()
	});
	transform();
}

function transform() {
	if(debug) console.log("> transform");

	var z=viewer.viewport.viewportToImageZoom(viewer.viewport.getZoom(true));
	var sw=viewer.source.width;
	var bounds=viewer.viewport.getBounds(true);
    var	x=magicV*bounds.x;
    var	y=magicV*bounds.y;
    var	w=magicV*bounds.width;
    var	h=magicV*bounds.height;
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
		params.tileSources=obj.tileSources;
                viewer = OpenSeadragon({
			id: "openseadragon1",
			prefixUrl: "lib/openseadragon/images/",
			tileSources: obj.tileSources,
                        showReferenceStrip: (obj.tileSources.length>1),
	                referenceStripSizeRatio: 0.2,
                        preserveViewport: true,
                        //sequenceMode: true,
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
		viewer.addHandler("page", function (data) {
			console.log(params.tileSources[data.page]);
		});
		viewer.addViewerInputHook({hooks: [
			{tracker: 'viewer', handler: 'clickHandler', hookHandler: clickHandler},
			{tracker: 'viewer', handler: 'pressHandler', hookHandler: pressHandler},
			{tracker: 'viewer', handler: 'dragHandler', hookHandler: dragHandler},
			{tracker: 'viewer', handler: 'dragEndHandler', hookHandler: dragEndHandler}
		]});
                
                // save real image size          
                $.get(params.tileSources[0], function(obj) {
                    var parser = new DOMParser();
                    xmlDoc = parser.parseFromString(obj,"text/xml");
                    //console.log(xmlDoc);
                    imageSize = xmlDoc.getElementsByTagName("Size")[0].attributes;
                    //console.log(imageSize); 
                });
                
		if(debug) console.log("< initMicrodraw resolve: success");
		def.resolve();
	});
	
	$(window).resize(function() {
		$("#regionList").height($(window).height()-$("#regionList").offset().top);
		resizeAnnotationOverlay();
	});

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
