define(function (require, exports, module) {
    "use strict";

    var DocumentManager		  = brackets.getModule("document/DocumentManager"),
    	EditorManager         = brackets.getModule("editor/EditorManager"),
    	EditorCommandHandlers = brackets.getModule("editor/EditorCommandHandlers");

    var EventManager          = require("core/EventManager");

    // based on Backbone.js' inherits	
	var ctor = function(){};
	var inherits = function(parent, protoProps) {
		var child;

		if (protoProps && protoProps.hasOwnProperty('constructor')) {
			child = protoProps.constructor;
		} else {
			child = function(){ return parent.apply(this, arguments); };
		}

		ctor.prototype = parent.prototype;
		child.prototype = new ctor();
		
		if (protoProps) {
            extend(child.prototype, protoProps);
        }
		
		child.prototype.constructor = child;
		child.__super__ = parent.prototype;
		return child;
	};

	function extend(target, ref) {
		var name, value;
		for ( name in ref ) {
			value = ref[name];
			if (value !== undefined) {
				target[ name ] = value;
			}
		}
		return target;
	}



	var Undo = function(){

		var _stack     = new Undo.Stack();
		var _enable    = true;
		var _tempStack = null;

		this.objectPropertyChanged = function(oldValue, newValue, obj, p, dirty) {
			var cmd;
			if(_enable) {
				cmd = new Undo.PropertyCmd(oldValue, newValue, obj, p, dirty);
				_stack.add(cmd);
			}
			return cmd;
		};

		this.beginUndoBatch = function() {
			_stack.beginBatch();
		};

		this.endUndoBatch = function() {
			_stack.endBatch();
		};

		this.clear = function() {
			_stack = new Undo.Stack();
			_tempStack = null;
		};

		this.temp = function() {
			_tempStack = _stack;
			_stack = new Undo.Stack();
			_stack.disableTriggerChange = true;
		};

		this.recover = function() {
			_stack = _tempStack;
		}

		this.undoing = function() {
			return _stack.undoing;
		};

		this.dirty = function() {
			return _stack.dirty();
		};

		this.save = function() {
			_stack.save();
		};

		this.setEnable = function(enable) {
			_enable = enable;
		}

		this.undo = EditorCommandHandlers.undo = function(){
			if(_enable && _stack.canUndo()) {
	    		_stack.undo();
            }
		};

		this.redo = EditorCommandHandlers.redo = function(){
			if(_enable && _stack.canRedo()) {
	    		_stack.redo();
            }
		};

		var undoList = [];
		this.registerUndoType = function(key) {
			undoList.push(key);
		};

		this.canInjectDocument = function(doc) {
			var name = doc.file.name;
			for(var k in undoList){
				if(name.endWith(undoList[k])) {
					return true;
                }
			}
			return false;
		};

		EventManager.on(EventManager.SCENE_BEGIN_PLAYING, this.temp);
		EventManager.on(EventManager.SCENE_END_PLAYING,   this.recover);
		EventManager.on(EventManager.SCENE_CLOSED,        this.clear);
	};


	Undo.Stack = function() {
		this.commands = [];
		this.stackPosition = -1;
		this.savePosition = -1;
		this.groupIndex = -1;
		this.undoing = false;
	};

	extend(Undo.Stack.prototype, {
		add: function(command) {
			if(this.undoing) { 
                return;
            }
            
			if(this.currentGroup) {
				this.currentGroup.add(command);
			}
		},
		beginBatch: function(cmd){
			if(this.undoing) {
                return;
            }
            
			this.groupIndex++;
			if(!this.currentGroup){
				this.currentGroup = new Undo.GroupCommand();
			}
		},
		endBatch: function(){
			if(this.undoing) {
                return;
            }
            
			this.groupIndex--;
			if(this.groupIndex === -1 && this.currentGroup.cmds.length !== 0){
				this._clearRedo();
				this.commands.push(this.currentGroup);
				this.stackPosition++;
				this.changed();
				this.currentGroup = null;
			}
		},
		undo: function() {
			this.undoing = true;
			this.commands[this.stackPosition].undo();
			this.stackPosition--;
			this.changed();
			this.undoing = false;
		},
		canUndo: function() {
			return this.stackPosition >= 0;
		},
		redo: function() {
			this.undoing = true;
			this.stackPosition++;
			this.commands[this.stackPosition].redo();
			this.changed();
			this.undoing = false;
		},
		canRedo: function() {
			return this.stackPosition < this.commands.length - 1;
		},
		save: function() {
			this.savePosition = this.stackPosition;
			this.changed();
		},
		dirty: function() {
			// return this.stackPosition !== this.savePosition;
			if(this.stackPosition !== this.savePosition) {
				var min = Math.min(this.stackPosition, this.savePosition);
				var max = Math.max(this.stackPosition, this.savePosition);

				for(var i=min+1; i<=max; i++){
					if(this.commands[i].dirty()) {
						return true;
					}
				}
			}
			return false;
		},
		_clearRedo: function() {
			// TODO there's probably a more efficient way for this
			this.commands = this.commands.slice(0, this.stackPosition + 1);
		},
		changed: function() {
			// do nothing, override

			if(editor && !this.disableTriggerChange) {
				editor.trigger("change", editor, []);
            }
		}
	});

	Undo.Command = function(name) {
		this.name = name;
	};

	var up = new Error("override me!");

	extend(Undo.Command.prototype, {
		undo: function() {
			throw up;
		},
		redo: function() {
			this.execute();
		}
	});

	Undo.Command.extend = function(protoProps) {
		var child = inherits(this, protoProps);
		child.extend = Undo.Command.extend;
		return child;
	};
		


	Undo.PropertyCmd = Undo.Command.extend({
		constructor: function(oldValue, newValue, obj, p, dirty){
			this.obj = obj;
			this.p = p;
			this.oldValue = oldValue;
			this.newValue = newValue;
			
			if(typeof oldValue === "function" && typeof newValue === "function") {
				dirty = obj;
			}
			this.dirty = dirty === undefined ? true : dirty;
		},
		undo: function(){
			if(typeof this.oldValue === "function") {
				this.oldValue(this.oldValue.params);
            }
			else if(this.oldValue.undo) {
				this.oldValue.undo();
            }
			else{
				this.obj[this.p] = this.oldValue;
			}
		},
		redo: function(){
			if(typeof this.newValue === "function") {
				this.newValue(this.newValue.params);
            }
			else if(this.newValue.redo) {
				this.newValue.redo();
            }
			else {
				this.obj[this.p] = this.newValue;
			}
		}
	});

	Undo.GroupCommand = Undo.Command.extend({
		constructor: function(){
			this.cmds = [];
		},
		undo: function(){
			for(var i = this.cmds.length-1 ; i>=0; i--){
				this.cmds[i].undo();
			}
		},
		redo: function(){
			for(var i=0; i<this.cmds.length; i++){
				this.cmds[i].redo();
			}
		},
		dirty: function() {
			for(var i=0; i<this.cmds.length; i++){
				if(this.cmds[i].dirty) {
					return true;
				}
			}
			return false;
		},
		add: function(cmd){
			this.cmds.push(cmd);
		},
		remove: function(index){
			this.cmds.remove(index);
		},
		clear: function(index){
			this.cmds = [];
		}
	});


	var undo = new Undo();
	module.exports = undo;


	var editor = null;
    EditorManager.on("activeEditorChange", function(event, current, previous){
    	editor = null;
    	if(!current || !undo.canInjectDocument(current.document)) { 
            return;
        }

    	editor = current;
    	editor._codeMirror.isClean = function(){
    		return !undo.dirty();
    	};
        
        current.undo = undo.undo;
        current.redo = undo.redo;
    });


    DocumentManager.on("documentSaved", function(event, doc){
    	if(!editor || editor.document !== doc) { 
            return;
        }

    	undo.save();
    });
});
