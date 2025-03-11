prism.run([
    'plugin-AdditionalInfoTooltip.services.bindOnce',
    function ($bindOnce) {
        var toolTipPanelName = "Additional Data";

        function getNextTooltipPanelName(widget) {
            if (!widget.metadata || !widget.metadata.panels) return "Additional Data";
            let maxNumber = 0;
            widget.metadata.panels.forEach(panel => {
                let match = panel.name.match(/Additional Data (\d+)/);
                if (match) {
                    let num = parseInt(match[1]);
                    if (!isNaN(num) && num > maxNumber) maxNumber = num;
                }
            });
            return `Additional Data ${maxNumber + 1}`;
        }

        function getCurrentTooltipPanelName(widget) {
            if (!widget.metadata || !widget.metadata.panels) return "Additional Data";
            let maxNumber = 0;
            widget.metadata.panels.forEach(panel => {
                let match = panel.name.match(/Additional Data (\d+)/);
                if (match) {
                    let num = parseInt(match[1]);
                    if (!isNaN(num) && num > maxNumber) maxNumber = num;
                }
            });
            return `Additional Data ${maxNumber}`;
        }

        function ensurePanelManifest(panel, widget) {
    
          
            if (!panel.$$manifest) {
            
                panel.$$manifest = {
                    name: panel.name,
                    type: 'series',
                    metadata: {
                        types: ['measures'],
                        maxitems: -1
                    },
                    itemAttributes: ["color"],
                    allowedColoringTypes: function () { 
                        return {
                            color : true,
                            condition:true
                        }; 
                    }, 
                    visibility: function () { 
                        
                        return true; }
                };
                if (!widget.manifest.data.panels.find(p => p.name === panel.name)) {
                    widget.manifest.data.panels.push(panel.$$manifest);
                }
            }
        }

        function addTooltipPanelToIndicator(widget) {
            if (widget.type !== "indicator") return;
            toolTipPanelName = getNextTooltipPanelName(widget);
            current = getCurrentTooltipPanelName(widget);
            
            var panel = widget.metadata.panel(toolTipPanelName);
            var panel2 = widget.metadata.panel(current);
         
            if (panel2 && !panel2?.items?.[0]) {
              
                var widgetPanel = window["dashboard-base"].models.widgetPanel;
                panel = widgetPanel.CreateFrom({
                    type: "series",
                    name: current,
                    title: current,
                    items: []
                });
              
                // widget.metadata.panels.push(panel);
            }else{
              
                var widgetPanel = window["dashboard-base"].models.widgetPanel;
                panel = widgetPanel.CreateFrom({
                    type: "series",
                    name: toolTipPanelName,
                    title: toolTipPanelName,
                    items: []
                });
                widget.metadata.panels.push(panel);
            }
            ensurePanelManifest(panel, widget);
            $bindOnce(widget, "processresult", addValuesToIndicatorPoint);
        }

        function addValuesToIndicatorPoint(e, args) {
            var panel = args.widget.metadata.panel(toolTipPanelName);
            if (!panel || panel.items.length === 0) return;
            if (!args.widget.additionalTooltipData) {
                args.widget.additionalTooltipData = [];
            }

            let additionalData = [];
            let rowData = [];
            let resultValue = args.result.data;

            if (resultValue && Array.isArray(resultValue)) {
                panel.items.forEach((item, index) => {
                    if (resultValue.length > index + 1) {
                        rowData.push({
                            jaql: item,
                            data: resultValue[index + 1]
                        });
                    }
                });
                if (rowData.length > 0) additionalData.push(rowData);
            }
            args.widget.additionalTooltipData = args.widget.additionalTooltipData.concat(additionalData);
        }

        prism.on("widgetloaded", function (e, args) {
            addTooltipPanelToIndicator(args.widget);
        });

        prism.on("dashboardloaded", function (e, args) {
            $bindOnce(args.dashboard, "widgetbuildquery", function (e, args) {});
        });
    }
]);

let lastActiveWidget = null;
let tooltip = null;
let tooltipTimeout = null;

// Lắng nghe sự kiện di chuột vào widget
document.addEventListener("mouseenter", handleWidgetMouseEnter, true);
document.addEventListener("mousemove", updateTooltipPosition);
document.addEventListener("mouseleave", handleWidgetMouseLeave, true);

// Xử lý khi chuột vào widget
function handleWidgetMouseEnter(event) {
   
    const widgetElement = event.target.closest(".widget");
    if (!widgetElement) return;

    const widgetId = widgetElement.getAttribute("widgetid");
    const widget = prism.activeDashboard.widgets.$$widgets.find(w => w.oid === widgetId);
    if (!widget) return;

    prism.activeWidget = widget;
    lastActiveWidget = widget;

    const additionalDataPanels = extractAdditionalData(widget);
    if (Object.keys(additionalDataPanels).length === 0) return;

    // Hủy xóa tooltip nếu chuột di chuyển nhanh giữa các widget
    clearTimeout(tooltipTimeout);

    showTooltip(event, additionalDataPanels);
}

// Xử lý khi chuột rời khỏi widget
function handleWidgetMouseLeave(event) {
  
    const widgetElement = event.target.closest(".widget");

    if (widgetElement) {
        lastActiveWidget = null;
    }

    if (!widgetElement && tooltip) {
        tooltip.setAttribute("data-hover", "false");

        // Thay vì xóa ngay, đợi một chút để tránh giật lag
        tooltipTimeout = setTimeout(() => {
            removeTooltipIfNeeded();
        }, 10); // Delay 200ms để tránh bị xóa quá sớm
    }
}

// Trích xuất dữ liệu bổ sung từ widget
function extractAdditionalData(widget) {
    if (!widget.queryResult || typeof widget.queryResult !== "object") return {};

    return Object.keys(widget.queryResult)
        .filter(key => key.startsWith("Additional Data"))
        .reduce((result, key) => {
            result[key] = widget.queryResult[key];
            return result;
        }, {});
}

// Hiển thị tooltip
function showTooltip(event, additionalDataPanels) {
    if (!tooltip) {
        tooltip = createTooltip();
    }

    tooltip.innerHTML = generateTooltipContent(additionalDataPanels);
    document.body.appendChild(tooltip);
    updateTooltipPosition(event);
}

// Tạo tooltip
function createTooltip() {
    const tooltip = document.createElement("div");
    tooltip.className = "custom-tooltip";

    tooltip.addEventListener("mouseenter", () => {
        tooltip.setAttribute("data-hover", "true");
        clearTimeout(tooltipTimeout); // Hủy xóa tooltip nếu đang hover vào
    });

    tooltip.addEventListener("mouseleave", () => {
        tooltip.setAttribute("data-hover", "false");
        tooltipTimeout = setTimeout(removeTooltipIfNeeded, 10); // Delay tránh giật
    });

    return tooltip;
}

// Tạo nội dung tooltip
function generateTooltipContent(dataPanels) {
    let content = `<div style="
        font-family: Arial, sans-serif;
        padding: 10px;
        background: white;
        border-radius: 5px;
        box-shadow: 0px 0px 10px rgba(0,0,0,0.2);
        border: 1px solid #ddd;
        min-width: 200px;
    ">`;

    Object.entries(dataPanels).forEach(([key, panel], index, array) => {
        const panelTitle = panel?.format?.jaql?.title || "N/A";
        const panelText = panel?.text || "N/A";
        const color = prism.activeWidget?.queryResult?.value?.color || "#000"; // Tránh lỗi khi `color` không có

        content += `
            <div style="font-weight: bold; color: #333; font-size: 14px; padding: 5px;">${panelTitle}</div>
            <div style="font-size: 16px; color: ${color}; font-weight: bold; padding: 5px;">${panelText}</div>
        `;

        if (index < array.length - 1) {
            content += `<hr style="border: none; border-top: 1px solid #ddd; margin: 8px 0;">`;
        }
    });

    return content + "</div>";
}

// Cập nhật vị trí tooltip
function updateTooltipPosition(event) {
    if (tooltip) {
        tooltip.style.position = "absolute";
        tooltip.style.top = event.pageY + 10 + "px";
        tooltip.style.left = event.pageX + 10 + "px";
        tooltip.style.zIndex = "1000";
    }
}

// Xóa tooltip nếu chuột không còn trong widget hoặc tooltip
function removeTooltipIfNeeded() {
    if (tooltip && tooltip.getAttribute("data-hover") === "false") {
        tooltip.remove();
        tooltip = null;
    }
}
