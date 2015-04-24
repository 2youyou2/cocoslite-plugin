/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define */


define(function (require, exports, module) {
    "use strict";

    var	CommandManager             = brackets.getModule("command/CommandManager");

    var	Vue                        = require("thirdparty/Vue"),
    	Commands                   = require("core/Commands"),
    	AddComponentHtml           = require("text!html/AddComponent.html"),
    	AddComponentTemplate       = require("text!html/AddComponentTemplate.html");


    function getComponentFolders() {

		var folders = {
			index: 0,
			title: "Component",
			pathes: {}
		};

		var cs = cl.ComponentManager.getAllClasses();
		for(var key in cs) {
			var c = cs[key];

			var folder = c.folder;
			if(!folder) {
				folders.pathes[c.className] = {name:c.className};
				} else {

				var pathes = folder.split('/');
				var lastPath = folders.pathes;

				if(pathes.length > folders.length) {
					folders.length = pathes.length;
				}

				for(var i=0; i<pathes.length; i++) {
					var path = pathes[i];

					if(!lastPath[path]) {
						lastPath[path] = {name:path, pathes:{}, deep:i+1};
					}

					lastPath = lastPath[path].pathes;
				}

				lastPath[c.className] = {name: c.className};
			}
		}

		return folders;
	}

    function attachButton($button) {

		var $el = $(AddComponentHtml);
		var folders = getComponentFolders();

		Vue.component('add-component', {
		    template: AddComponentTemplate,
		    data: function() {
		    	return {
		    		select: false
		    	};
		    },
		    methods: {
		    	onClick: function() {
		    		if(this.$data.pathes) {
		    			this.$root.index += 1;
		    			this.$root.title = this.$data.name.capitalize();
		    			this.$root.last = this.$data;
		    		} else {
		    			var cmd = Commands.CMD_COMPONENT + '.' + this.$data.name;
		    			CommandManager.execute(cmd);

		    			// hide popover
		    			$button.click();
		    		}
		    	},
		    	onMouseEnter: function() {
		    		if(this.$parent) {
		    			if(this.$parent.current) {
		    				$(this.$parent.current.$el).removeClass("select");
		    			}
		    			$(this.$el).addClass("select");
		    			this.$parent.current = this;
		    		}
		    	}
		    }
		});

		new Vue({
			el: $el[0],
			data: folders,
			methods: {
				onClickTitle: function() {
					if(this.$root.index > 0) {
						this.$root.index -= 1;
						this.$root.title = this.$root.index === 0 ? 'Component' : this.$root.last.name.capitalize();
					}
				}
			}
		});

		var template = '<div class="webui-popover">'+
								'<div class="arrow"></div>'+
								'<div class="webui-popover-inner">'+
									'<a href="#" class="close">x</a>'+
									'<div class="webui-popover-content"><i class="icon-refresh"></i> <p>&nbsp;</p></div>'+
								'</div>'+
							'</div>';

		$button.webuiPopover({template: template, content:$el, width:'190px', animation:'pop'})
			.on("show.webui.popover", function() {
				folders.index = 0;
			});
	}

	exports.attachButton = attachButton;
});