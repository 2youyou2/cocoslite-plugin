/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define */


define(function (require, exports, module) {
    "use strict";

	var	Dialogs        = brackets.getModule("widgets/Dialogs");

    var	Project        = require("core/Project"),
    	Vue            = require("thirdparty/Vue"),
    	ShowAssetsHtml = require("text!html/ShowAssets.html");

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

	exports.showSelectAssets = showSelectAssets;
	exports.imgFilter = imgFilter;
});
