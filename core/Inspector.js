/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, cl*/

define(function (require, exports, module) {
    "use strict";

	var Resizer 	   = brackets.getModule("utils/Resizer"),
		ThemeManager   = brackets.getModule("view/ThemeManager"),
		ExtensionUtils = brackets.getModule("utils/ExtensionUtils"),
		Dialogs        = brackets.getModule("widgets/Dialogs");

    var ObjectManager  = require("core/ObjectManager"),
    	Project        = require("core/Project"),
    	EventManager   = require("core/EventManager"),
    	Undo 		   = require("core/Undo"),
    	EditorManager  = require("editor/EditorManager"),
    	Vue            = require("thirdparty/Vue"),
    	Dropkick       = require("thirdparty/dropkick"),
    	ColorPicker    = require("thirdparty/colorpicker/js/bootstrap-colorpicker"),
    	InspectorHtml  = require("text!html/Inspector.html"),
    	ShowAssetsHtml = require("text!html/ShowAssets.html");


    var $content = $(InspectorHtml);
    $content.insertAfter(".content");

    var $inspector    = $content.find(".inspector");
    var $addComponent = $content.find(".add-component");

    Resizer.makeResizable($content, Resizer.DIRECTION_HORIZONTAL, Resizer.POSITION_LEFT, 250);

    $content.on("panelResizeUpdate", onResize);

    $.extend({
	    includePath: '',
	    include: function(file) {
	        var files = typeof file == "string" ? [file]:file;
	        for (var i = 0; i < files.length; i++) {
	            var name = files[i];
	            var att = name.split('.');
	            var ext = att[att.length - 1].toLowerCase();
	            var isCSS = ext == "css";
	            var tag = isCSS ? "link" : "script";
	            var attr = isCSS ? " type='text/css' rel='stylesheet' " : " language='javascript' type='text/javascript' ";
	            var link = (isCSS ? "href" : "src") + "='" + $.includePath + name + "'";
	            if ($(tag + "[" + link + "]").length == 0) $('head').append($("<" + tag + attr + link + "></" + tag + ">"));
	        }
	   }
	});
    var cssPath = ExtensionUtils.getModulePath(module, "../thirdparty/colorpicker/css/bootstrap-colorpicker.css");
	$.include([cssPath]);

	var currentObject = null, tempObject = null;
	var showing = false;

	function width() {
		return $content.width();
	}

	function onResize() {
        $(".main-view .content").css({"right": width() + "px"});
        cc.view._resizeEvent();
	}

	function show(speed){
		showing = true;

		if(speed === undefined) {
            speed = 500;
        }
        
		$content.css({"right":"0px"});
		$(".main-view .content").css({"right": width() + "px"});
        
        if(cc.view) {
        	cc.view._resizeEvent();
        }
	}

	function hide(speed){
		showing = false;

		if(speed === undefined) {
            speed = 500;
        }

		$content.css({"right":-$content.width()+"px"});
		$(".main-view .content").css({"right": "0px"});
		
		if(cc.view) {
			cc.view._resizeEvent();
		}
	}
	
	function bindInput(input, obj, key){

		input.finishEdit = function(stopUndoBatch){
			if(!stopUndoBatch) {
				Undo.beginUndoBatch();
			}

			if(input.updateValue) {
                input.updateValue();
            }
            
			input.innerChanged = true;

			var newValue = input.realValue ? input.realValue : input.value;

			if(obj.constructor === Array) {
				obj.set(key, newValue); 
                
				if(obj.valueChanged) {
                    obj.valueChanged();
                }
			}
			else {
                obj[key] = newValue;
            }

			input.innerChanged = false;

			if(!stopUndoBatch) {
				Undo.endUndoBatch();
			}
		};

		obj._inspectorInputMap[key] = input;

		input.value = obj[key];
		input.innerChanged = false;
	}

	function createInputForArray(array, $input){
		for(var i=0; i<array.length; i++){
			var $item = $("<div class='array-item'>");
			$item.append($("<span class='number'>#"+i+"</span>"));
			
			createInput(array, i, $item, true);
            
			$input.append($item);
		}
	}

	function createInputForDefaultValue(obj, key, value) {

		var $input = null;
  		
		if(typeof value === 'boolean'){
  			$input = $('<span class="check value" v-on="click: onClick">');
            $input.addClass('{{checked ? "fa-check" : "fa-square-o"}}');

            var vue = new Vue({
                el: $input[0],
                data: {
                    checked: false
                },
                methods: {
                    onClick: function() {
                        $input.checked = this.checked = !this.checked;
                        $input.finishEdit();
                    }
                }
            });

            cl.defineGetterSetter($input, "value", function(){
                return $input.checked;
            }, function(val){
                vue.$data.checked = $input.checked = val;
            });
		}

  		else {
  			$input = $("<span><input></span>");
  			var input = $input.find('input')[0];

  			if(typeof value === 'string') {
                input.setAttribute('type', 'text');
            }
	  		else if(typeof value === 'number') {
  				$input.updateValue = function(){
  					this.realValue = parseFloat(this.value);
  				};
  			}

  			input.onkeypress = function(event){
	  			if(typeof $input.finishEdit === 'function' && event.keyCode === 13) {
	            	$input.finishEdit();
	            }
	  		};

	  		input.onblur = function(event){
	  			if(typeof $input.finishEdit === 'function'){
	  				if($input.updateValue) {
	                    $input.updateValue();
	                }
	  				if($input.realValue !== obj[key]) {
	                    $input.finishEdit();
	                }
	  			}    
	  		};

			cl.defineGetterSetter($input, "value", function(){
				return input.value;
			}, function(val){
				input.value = val;
			});
  		}

		return $input;
	}

	function showSelectAssets(filter, onChooseAsset) {

		onChooseAsset = onChooseAsset ? onChooseAsset : function() {};

		Project.getResources(filter).then(function(resources) {

			var grid = [];
			var row;

			resources.splice(0,0, {
				fullPath: "",
				name: "None"
			})

			for(var i=0; i<resources.length; i++) {
				// if(i % 4 === 0) {
				// 	row = [];
				// 	grid.push(row);
				// }

				var file = resources[i];

				var data = {
					fullPath: file.fullPath,
					name: file.name
				};

				grid.push(data);
			}

			var $dialog = $(ShowAssetsHtml);

			new Vue({
				el: $dialog[0],
				data: {
					grid: grid
				},
				methods: {
					chooseAsset: onChooseAsset
				}
			})

			var dialog = Dialogs.showModalDialogUsingTemplate($dialog);

			dialog.done(function (id) {
	            if (id === Dialogs.DIALOG_BTN_OK) {
	                
	            }
	        });

		});
	}

	function imgFilter(file) {
		var name = file.name;
		return name.endWith('.png') || name.endWith('.jpg');
	}


	function createInputForObject(obj, key, value) {
		var $input = null;

		if(value.constructor === cl.Point){
			/*jshint multistr: true */
            $input = $("<span>\
						<span style='width:50%;margin-right:2px;float:left;display:block;overflow:hidden;'><input class='x-input'></span>\
					    <span style='display:block;overflow:hidden;'><input class='y-input'></span>\
					    </span>");
			var xInput = $input.find('.x-input')[0];
			var yInput = $input.find('.y-input')[0];

			cl.defineGetterSetter($input, "value", function(){
				var x = parseFloat(xInput.value);
					var y = parseFloat(yInput.value);
					return cl.p(x, y);
			}, function(val){
				xInput.value = val.x;
				yInput.value = val.y;
			});

			$input.find("input").each(function(i, e){
				this.onkeypress = function(event){
		  			if(typeof $input.finishEdit === 'function' && event.keyCode === 13) {
                        $input.finishEdit();
                    }
		  		};

		  		this.onblur = function(event){
		  			if(typeof $input.finishEdit === 'function'){
		  				if($input.updateValue) {
                            $input.updateValue();
                        }
		  				if($input.value.x !== obj[key].x || $input.value.y !== obj[key].y) {
                            $input.finishEdit();
                        }
		  			}
		  		};
			});
		}
		else if(value.constructor === cl.EnumValue) {
			$input = $('<span style="overflow:initial"><select></span>');
			var $select = $input.find('select');
			$select.attr('id', obj.classname + '_' + key);

			value.Enum.forEach(function(key, value) {
				var $option = $("<option>")
					.attr('value', key)
					.text(key);

				$select.append($option);
			});

			$select.dropkick({
				change: function(v, label) {
					$input.value = value.Enum[v];
					$input.finishEdit();
				}
			});
			$input.find(".select-icon").addClass("fa-play");
		}
		else if(value.constructor === cc.Sprite) {
			$input = $("<span class='sprite'>");
			
			var $search = $("<span class='search fa-search'>");
			var $imgWrap = $("<span><img></span>");
			var $img = $imgWrap.find('img');

			$input.append($search);
			$input.append($imgWrap);

			$search.click(function() {
				showSelectAssets(imgFilter, function(data) {
					$img.attr("src", data.fullPath);
					$input.finishEdit();
				});
			});

			cl.defineGetterSetter($input, "value", function(){
                return $img.attr("src").replace(cc.loader.resPath, "");
            }, function(file){
            	if(typeof file === "object" && file.constructor === cc.Sprite) {
            		if(file.getTexture()) {
            			file = file.getTexture().url;
            			file = cc.loader.getUrl(file);
            		} else {
            			file = null;
            		}
            	}

                $img.attr("src", file)
            });
		}
		else if(value.constructor === cc.Color) {
			$input = $("<span class='input-group'><input type='text'class='form-control' value='#fff'><span class='input-group-addon'><i></i></span>");

  			$input.colorpicker({color:'#fff'}).on('changeColor.colorpicker', function(event){
				$input.color = event.color.toRGB();
				$input.finishEdit(true);
			}).on('endChangeColor.colorpicker', function() {
				Undo.endUndoBatch();
			}).on('beginChangeColor.colorpicker', function() {
				Undo.beginUndoBatch();
			});

  			cl.defineGetterSetter($input, "value", function() {
                return $input.color;
            }, function(color) {
            	$input.colorpicker('setValue', cc.colorToHex(color));
            });
		}
		else if(value.constructor === Array) {
			value._inspectorInputMap = {};

			$input = $("<div class='array'>");
			
			createInputForArray(value, $input);

			value._inspectorInput = $input;
		}

		return $input;
	}

	function createInput(obj, key, el, discardKey){
		var $input;
		var value = obj[key];

		var editors = EditorManager.getOrderedEditors();
		for(var i=0; i<editors.length; i++) {
			var editor = editors[i];

			if(editor.createInput) {
				try{
					$input = editor.createInput(obj, key, value);
				}
				catch(err) {
					console.log("Editor [%s] crateInput failed : ", editor.name, err);
				}

				if($input) {
					break;
				}
			}
		}

		if($input) {
			// need do nothing
		}
		else if(typeof value !== 'object') {
			$input = createInputForDefaultValue(obj, key, value);
		}
		else {
			$input = createInputForObject(obj, key, value);
		}
		
		if($input){
			bindInput($input, obj, key);
		}
		else {
			$input = $('<span></span>');
		}

		if(!discardKey) {
			// Change first letter to upper case
			var temp = key.substring(0,1).toUpperCase();
			temp += key.substring(1,key.length);

			var $key = $('<span class="key">'+temp+'</span>');
			el.append($key);
		}

		$input.addClass("value");
		el.append($input);
	}

	function initComponentUI(component){
		component._inspectorInputMap = {};

		var el = $('<div>');
		el.appendTo($inspector);
		el.attr('id', component.classname);
		el.addClass('component');

		var title = $('<div class="component-title">'+component.classname+'</div>');
		el.append(title);

		var icon = $('<span class="fa-caret-down indicate">');
		title.append(icon);

		var settings = $('<span class="fa-cog settings">');
		title.append(settings);

		var content = $('<div class="component-content">');
		el.append(content);

		title.click(function() {

			if(content.is(':visible')) {
				icon.removeClass('fa-caret-down');
				icon.addClass('fa-caret-right');
			} else {
				icon.addClass('fa-caret-down');
				icon.removeClass('fa-caret-right');
			}

			content.toggle();
		});

		var ps = component.properties;
		for(var k=0; k<ps.length; k++){
			var p = ps[k];
			
			var row = $('<div class="row">');
			content.append(row);
			
			createInput(component, p, row);
		}
	}

	function initObjectUI(obj){
		var cs = currentObject.components;
		if(!cs) {
            return;
        }

		for(var key in cs){
			initComponentUI(cs[key]);
		}
	}

	function handleSelectedObject(event, objs){
		clear();

		var obj = objs[0];
		if(!obj) {
            return;
        }

		currentObject = obj;

		// $addComponent.show();
		initObjectUI(obj);
	}

	function handleComponentAdded(event, component) {
		if(component.target !== currentObject) {
            return;
        }

		initComponentUI(component);
	}

	function handleComponentRemoved(event, component) {
		if(component.target != currentObject) {
			return;
		}

		$inspector.find('#'+component.classname).remove();
	}

	function handleObjectPropertyChanged(event, o, p) {
		if(!o._inspectorInputMap) {
			return;
		}

		if(o.constructor === Array && p===""){
			if(o._inspectorInput.innerChanged) {
                return;
            }
			o._inspectorInput.empty();

			createInputForArray(o, o._inspectorInput);
			
			return;
		}
		var input = o._inspectorInputMap[p];
		if(input && !input.innerChanged) {
            input.value = o[p];
        }
	}


	function clear() {
		currentObject = null;
		$inspector.empty();
		$addComponent.hide();
	}

	EventManager.on(EventManager.SELECT_OBJECTS,          handleSelectedObject);
	EventManager.on(EventManager.COMPONENT_ADDED,         handleComponentAdded);
	EventManager.on(EventManager.COMPONENT_REMOVED,       handleComponentRemoved);
	EventManager.on(EventManager.OBJECT_PROPERTY_CHANGED, handleObjectPropertyChanged);
	EventManager.on(EventManager.SCENE_CLOSED,            clear);

	exports.show  = show;
	exports.hide  = hide;
	exports.clear = clear;
	exports.__defineGetter__("showing", function(){
		return showing;
	});
});