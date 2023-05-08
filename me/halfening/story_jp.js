// Created with Squiffy 5.1.3
// https://github.com/textadventures/squiffy

(function(){
/* jshint quotmark: single */
/* jshint evil: true */

var squiffy = {};

(function () {
    'use strict';

    squiffy.story = {};

    var initLinkHandler = function () {
        var handleLink = function (link) {
            if (link.hasClass('disabled')) return;
            var passage = link.data('passage');
            var section = link.data('section');
            var rotateAttr = link.attr('data-rotate');
            var sequenceAttr = link.attr('data-sequence');
            if (passage) {
                disableLink(link);
                squiffy.set('_turncount', squiffy.get('_turncount') + 1);
                passage = processLink(passage);
                if (passage) {
                    currentSection.append('<hr/>');
                    squiffy.story.passage(passage);
                }
                var turnPassage = '@' + squiffy.get('_turncount');
                if (turnPassage in squiffy.story.section.passages) {
                    squiffy.story.passage(turnPassage);
                }
                if ('@last' in squiffy.story.section.passages && squiffy.get('_turncount')>= squiffy.story.section.passageCount) {
                    squiffy.story.passage('@last');
                }
            }
            else if (section) {
                currentSection.append('<hr/>');
                disableLink(link);
                section = processLink(section);
                squiffy.story.go(section);
            }
            else if (rotateAttr || sequenceAttr) {
                var result = rotate(rotateAttr || sequenceAttr, rotateAttr ? link.text() : '');
                link.html(result[0].replace(/&quot;/g, '"').replace(/&#39;/g, '\''));
                var dataAttribute = rotateAttr ? 'data-rotate' : 'data-sequence';
                link.attr(dataAttribute, result[1]);
                if (!result[1]) {
                    disableLink(link);
                }
                if (link.attr('data-attribute')) {
                    squiffy.set(link.attr('data-attribute'), result[0]);
                }
                squiffy.story.save();
            }
        };

        squiffy.ui.output.on('click', 'a.squiffy-link', function () {
            handleLink(jQuery(this));
        });

        squiffy.ui.output.on('keypress', 'a.squiffy-link', function (e) {
            if (e.which !== 13) return;
            handleLink(jQuery(this));
        });

        squiffy.ui.output.on('mousedown', 'a.squiffy-link', function (event) {
            event.preventDefault();
        });
    };

    var disableLink = function (link) {
        link.addClass('disabled');
        link.attr('tabindex', -1);
    }
    
    squiffy.story.begin = function () {
        if (!squiffy.story.load()) {
            squiffy.story.go(squiffy.story.start);
        }
    };

    var processLink = function(link) {
		link = String(link);
        var sections = link.split(',');
        var first = true;
        var target = null;
        sections.forEach(function (section) {
            section = section.trim();
            if (startsWith(section, '@replace ')) {
                replaceLabel(section.substring(9));
            }
            else {
                if (first) {
                    target = section;
                }
                else {
                    setAttribute(section);
                }
            }
            first = false;
        });
        return target;
    };

    var setAttribute = function(expr) {
        var lhs, rhs, op, value;
        var setRegex = /^([\w]*)\s*=\s*(.*)$/;
        var setMatch = setRegex.exec(expr);
        if (setMatch) {
            lhs = setMatch[1];
            rhs = setMatch[2];
            if (isNaN(rhs)) {
				if(startsWith(rhs,"@")) rhs=squiffy.get(rhs.substring(1));
                squiffy.set(lhs, rhs);
            }
            else {
                squiffy.set(lhs, parseFloat(rhs));
            }
        }
        else {
			var incDecRegex = /^([\w]*)\s*([\+\-\*\/])=\s*(.*)$/;
            var incDecMatch = incDecRegex.exec(expr);
            if (incDecMatch) {
                lhs = incDecMatch[1];
                op = incDecMatch[2];
				rhs = incDecMatch[3];
				if(startsWith(rhs,"@")) rhs=squiffy.get(rhs.substring(1));
				rhs = parseFloat(rhs);
                value = squiffy.get(lhs);
                if (value === null) value = 0;
                if (op == '+') {
                    value += rhs;
                }
                if (op == '-') {
                    value -= rhs;
                }
				if (op == '*') {
					value *= rhs;
				}
				if (op == '/') {
					value /= rhs;
				}
                squiffy.set(lhs, value);
            }
            else {
                value = true;
                if (startsWith(expr, 'not ')) {
                    expr = expr.substring(4);
                    value = false;
                }
                squiffy.set(expr, value);
            }
        }
    };

    var replaceLabel = function(expr) {
        var regex = /^([\w]*)\s*=\s*(.*)$/;
        var match = regex.exec(expr);
        if (!match) return;
        var label = match[1];
        var text = match[2];
        if (text in squiffy.story.section.passages) {
            text = squiffy.story.section.passages[text].text;
        }
        else if (text in squiffy.story.sections) {
            text = squiffy.story.sections[text].text;
        }
        var stripParags = /^<p>(.*)<\/p>$/;
        var stripParagsMatch = stripParags.exec(text);
        if (stripParagsMatch) {
            text = stripParagsMatch[1];
        }
        var $labels = squiffy.ui.output.find('.squiffy-label-' + label);
        $labels.fadeOut(1000, function() {
            $labels.html(squiffy.ui.processText(text));
            $labels.fadeIn(1000, function() {
                squiffy.story.save();
            });
        });
    };

    squiffy.story.go = function(section) {
        squiffy.set('_transition', null);
        newSection();
        squiffy.story.section = squiffy.story.sections[section];
        if (!squiffy.story.section) return;
        squiffy.set('_section', section);
        setSeen(section);
        var master = squiffy.story.sections[''];
        if (master) {
            squiffy.story.run(master);
            squiffy.ui.write(master.text);
        }
        squiffy.story.run(squiffy.story.section);
        // The JS might have changed which section we're in
        if (squiffy.get('_section') == section) {
            squiffy.set('_turncount', 0);
            squiffy.ui.write(squiffy.story.section.text);
            squiffy.story.save();
        }
    };

    squiffy.story.run = function(section) {
        if (section.clear) {
            squiffy.ui.clearScreen();
        }
        if (section.attributes) {
            processAttributes(section.attributes);
        }
        if (section.js) {
            section.js();
        }
    };

    squiffy.story.passage = function(passageName) {
        var passage = squiffy.story.section.passages[passageName];
        if (!passage) return;
        setSeen(passageName);
        var masterSection = squiffy.story.sections[''];
        if (masterSection) {
            var masterPassage = masterSection.passages[''];
            if (masterPassage) {
                squiffy.story.run(masterPassage);
                squiffy.ui.write(masterPassage.text);
            }
        }
        var master = squiffy.story.section.passages[''];
        if (master) {
            squiffy.story.run(master);
            squiffy.ui.write(master.text);
        }
        squiffy.story.run(passage);
        squiffy.ui.write(passage.text);
        squiffy.story.save();
    };

    var processAttributes = function(attributes) {
        attributes.forEach(function (attribute) {
            if (startsWith(attribute, '@replace ')) {
                replaceLabel(attribute.substring(9));
            }
            else {
                setAttribute(attribute);
            }
        });
    };

    squiffy.story.restart = function() {
        if (squiffy.ui.settings.persist && window.localStorage) {
            var keys = Object.keys(localStorage);
            jQuery.each(keys, function (idx, key) {
                if (startsWith(key, squiffy.story.id)) {
                    localStorage.removeItem(key);
                }
            });
        }
        else {
            squiffy.storageFallback = {};
        }
        if (squiffy.ui.settings.scroll === 'element') {
            squiffy.ui.output.html('');
            squiffy.story.begin();
        }
        else {
            location.reload();
        }
    };

    squiffy.story.save = function() {
        squiffy.set('_output', squiffy.ui.output.html());
    };

    squiffy.story.load = function() {
        var output = squiffy.get('_output');
        if (!output) return false;
        squiffy.ui.output.html(output);
        currentSection = jQuery('#' + squiffy.get('_output-section'));
        squiffy.story.section = squiffy.story.sections[squiffy.get('_section')];
        var transition = squiffy.get('_transition');
        if (transition) {
            eval('(' + transition + ')()');
        }
        return true;
    };

    var setSeen = function(sectionName) {
        var seenSections = squiffy.get('_seen_sections');
        if (!seenSections) seenSections = [];
        if (seenSections.indexOf(sectionName) == -1) {
            seenSections.push(sectionName);
            squiffy.set('_seen_sections', seenSections);
        }
    };

    squiffy.story.seen = function(sectionName) {
        var seenSections = squiffy.get('_seen_sections');
        if (!seenSections) return false;
        return (seenSections.indexOf(sectionName) > -1);
    };
    
    squiffy.ui = {};

    var currentSection = null;
    var screenIsClear = true;
    var scrollPosition = 0;

    var newSection = function() {
        if (currentSection) {
            disableLink(jQuery('.squiffy-link', currentSection));
        }
        var sectionCount = squiffy.get('_section-count') + 1;
        squiffy.set('_section-count', sectionCount);
        var id = 'squiffy-section-' + sectionCount;
        currentSection = jQuery('<div/>', {
            id: id,
        }).appendTo(squiffy.ui.output);
        squiffy.set('_output-section', id);
    };

    squiffy.ui.write = function(text) {
        screenIsClear = false;
        scrollPosition = squiffy.ui.output.height();
        currentSection.append(jQuery('<div/>').html(squiffy.ui.processText(text)));
        squiffy.ui.scrollToEnd();
    };

    squiffy.ui.clearScreen = function() {
        squiffy.ui.output.html('');
        screenIsClear = true;
        newSection();
    };

    squiffy.ui.scrollToEnd = function() {
        var scrollTo, currentScrollTop, distance, duration;
        if (squiffy.ui.settings.scroll === 'element') {
            scrollTo = squiffy.ui.output[0].scrollHeight - squiffy.ui.output.height();
            currentScrollTop = squiffy.ui.output.scrollTop();
            if (scrollTo > currentScrollTop) {
                distance = scrollTo - currentScrollTop;
                duration = distance / 0.4;
                squiffy.ui.output.stop().animate({ scrollTop: scrollTo }, duration);
            }
        }
        else {
            scrollTo = scrollPosition;
            currentScrollTop = Math.max(jQuery('body').scrollTop(), jQuery('html').scrollTop());
            if (scrollTo > currentScrollTop) {
                var maxScrollTop = jQuery(document).height() - jQuery(window).height();
                if (scrollTo > maxScrollTop) scrollTo = maxScrollTop;
                distance = scrollTo - currentScrollTop;
                duration = distance / 0.5;
                jQuery('body,html').stop().animate({ scrollTop: scrollTo }, duration);
            }
        }
    };

    squiffy.ui.processText = function(text) {
        function process(text, data) {
            var containsUnprocessedSection = false;
            var open = text.indexOf('{');
            var close;
            
            if (open > -1) {
                var nestCount = 1;
                var searchStart = open + 1;
                var finished = false;
             
                while (!finished) {
                    var nextOpen = text.indexOf('{', searchStart);
                    var nextClose = text.indexOf('}', searchStart);
         
                    if (nextClose > -1) {
                        if (nextOpen > -1 && nextOpen < nextClose) {
                            nestCount++;
                            searchStart = nextOpen + 1;
                        }
                        else {
                            nestCount--;
                            searchStart = nextClose + 1;
                            if (nestCount === 0) {
                                close = nextClose;
                                containsUnprocessedSection = true;
                                finished = true;
                            }
                        }
                    }
                    else {
                        finished = true;
                    }
                }
            }
            
            if (containsUnprocessedSection) {
                var section = text.substring(open + 1, close);
                var value = processTextCommand(section, data);
                text = text.substring(0, open) + value + process(text.substring(close + 1), data);
            }
            
            return (text);
        }

        function processTextCommand(text, data) {
            if (startsWith(text, 'if ')) {
                return processTextCommand_If(text, data);
            }
            else if (startsWith(text, 'else:')) {
                return processTextCommand_Else(text, data);
            }
            else if (startsWith(text, 'label:')) {
                return processTextCommand_Label(text, data);
            }
            else if (/^rotate[: ]/.test(text)) {
                return processTextCommand_Rotate('rotate', text, data);
            }
            else if (/^sequence[: ]/.test(text)) {
                return processTextCommand_Rotate('sequence', text, data);   
            }
            else if (text in squiffy.story.section.passages) {
                return process(squiffy.story.section.passages[text].text, data);
            }
            else if (text in squiffy.story.sections) {
                return process(squiffy.story.sections[text].text, data);
            }
			else if (startsWith(text,'@') && !startsWith(text,'@replace')) {
				processAttributes(text.substring(1).split(","));
				return "";
			}
            return squiffy.get(text);
        }

        function processTextCommand_If(section, data) {
            var command = section.substring(3);
            var colon = command.indexOf(':');
            if (colon == -1) {
                return ('{if ' + command + '}');
            }

            var text = command.substring(colon + 1);
            var condition = command.substring(0, colon);
			condition = condition.replace("<", "&lt;");
            var operatorRegex = /([\w ]*)(=|&lt;=|&gt;=|&lt;&gt;|&lt;|&gt;)(.*)/;
            var match = operatorRegex.exec(condition);

            var result = false;

            if (match) {
                var lhs = squiffy.get(match[1]);
                var op = match[2];
                var rhs = match[3];

				if(startsWith(rhs,'@')) rhs=squiffy.get(rhs.substring(1));
				
                if (op == '=' && lhs == rhs) result = true;
                if (op == '&lt;&gt;' && lhs != rhs) result = true;
                if (op == '&gt;' && lhs > rhs) result = true;
                if (op == '&lt;' && lhs < rhs) result = true;
                if (op == '&gt;=' && lhs >= rhs) result = true;
                if (op == '&lt;=' && lhs <= rhs) result = true;
            }
            else {
                var checkValue = true;
                if (startsWith(condition, 'not ')) {
                    condition = condition.substring(4);
                    checkValue = false;
                }

                if (startsWith(condition, 'seen ')) {
                    result = (squiffy.story.seen(condition.substring(5)) == checkValue);
                }
                else {
                    var value = squiffy.get(condition);
                    if (value === null) value = false;
                    result = (value == checkValue);
                }
            }

            var textResult = result ? process(text, data) : '';

            data.lastIf = result;
            return textResult;
        }

        function processTextCommand_Else(section, data) {
            if (!('lastIf' in data) || data.lastIf) return '';
            var text = section.substring(5);
            return process(text, data);
        }

        function processTextCommand_Label(section, data) {
            var command = section.substring(6);
            var eq = command.indexOf('=');
            if (eq == -1) {
                return ('{label:' + command + '}');
            }

            var text = command.substring(eq + 1);
            var label = command.substring(0, eq);

            return '<span class="squiffy-label-' + label + '">' + process(text, data) + '</span>';
        }

        function processTextCommand_Rotate(type, section, data) {
            var options;
            var attribute = '';
            if (section.substring(type.length, type.length + 1) == ' ') {
                var colon = section.indexOf(':');
                if (colon == -1) {
                    return '{' + section + '}';
                }
                options = section.substring(colon + 1);
                attribute = section.substring(type.length + 1, colon);
            }
            else {
                options = section.substring(type.length + 1);
            }
            var rotation = rotate(options.replace(/"/g, '&quot;').replace(/'/g, '&#39;'));
            if (attribute) {
                squiffy.set(attribute, rotation[0]);
            }
            return '<a class="squiffy-link" data-' + type + '="' + rotation[1] + '" data-attribute="' + attribute + '" role="link">' + rotation[0] + '</a>';
        }

        var data = {
            fulltext: text
        };
        return process(text, data);
    };

    squiffy.ui.transition = function(f) {
        squiffy.set('_transition', f.toString());
        f();
    };

    squiffy.storageFallback = {};

    squiffy.set = function(attribute, value) {
        if (typeof value === 'undefined') value = true;
        if (squiffy.ui.settings.persist && window.localStorage) {
            localStorage[squiffy.story.id + '-' + attribute] = JSON.stringify(value);
        }
        else {
            squiffy.storageFallback[attribute] = JSON.stringify(value);
        }
        squiffy.ui.settings.onSet(attribute, value);
    };

    squiffy.get = function(attribute) {
        var result;
        if (squiffy.ui.settings.persist && window.localStorage) {
            result = localStorage[squiffy.story.id + '-' + attribute];
        }
        else {
            result = squiffy.storageFallback[attribute];
        }
        if (!result) return null;
        return JSON.parse(result);
    };

    var startsWith = function(string, prefix) {
        return string.substring(0, prefix.length) === prefix;
    };

    var rotate = function(options, current) {
        var colon = options.indexOf(':');
        if (colon == -1) {
            return [options, current];
        }
        var next = options.substring(0, colon);
        var remaining = options.substring(colon + 1);
        if (current) remaining += ':' + current;
        return [next, remaining];
    };

    var methods = {
        init: function (options) {
            var settings = jQuery.extend({
                scroll: 'body',
                persist: true,
                restartPrompt: true,
                onSet: function (attribute, value) {}
            }, options);

            squiffy.ui.output = this;
            squiffy.ui.restart = jQuery(settings.restart);
            squiffy.ui.settings = settings;

            if (settings.scroll === 'element') {
                squiffy.ui.output.css('overflow-y', 'auto');
            }

            initLinkHandler();
            squiffy.story.begin();
            
            return this;
        },
        get: function (attribute) {
            return squiffy.get(attribute);
        },
        set: function (attribute, value) {
            squiffy.set(attribute, value);
        },
        restart: function () {
            if (!squiffy.ui.settings.restartPrompt || confirm('本当に最初からやり直しますか？')) {
                squiffy.story.restart();
            }
        }
    };

    jQuery.fn.squiffy = function (methodOrOptions) {
        if (methods[methodOrOptions]) {
            return methods[methodOrOptions]
                .apply(this, Array.prototype.slice.call(arguments, 1));
        }
        else if (typeof methodOrOptions === 'object' || ! methodOrOptions) {
            return methods.init.apply(this, arguments);
        } else {
            jQuery.error('Method ' +  methodOrOptions + ' does not exist');
        }
    };
})();

var get = squiffy.get;
var set = squiffy.set;


squiffy.story.start = 'mainmenu';
squiffy.story.id = 'e4355f2cbd';
squiffy.story.sections = {
	'scoreboard': {
		'text': "<p><span class=\"scoreboard\" style=\"display: block; background: black; color: white; text-align: center; padding: 0.5em 0;\">賞金 ¥{score}</span></p>",
		'passages': {
		},
	},
	'mainmenu': {
		'text': "{scoreboard}\n<p>『ハンハンター』は、ひねりが利いたパーティー雑学ゲーム『乱雑学』の予告編ミニゲームです。フルボイスでネット上でも対戦できる面白いゲームですよ！ 英語版は<a href=\"https://haitouch.ga/me/salty\">ここ</a>で公開済みです。</p><p>このゲームは<ruby>Squiffy<rp>（</rp><rt>スクイッフィー</rt><rp>）</rp></ruby>というエンジンで駆動しています。ページから移動してもオートセーブで経過が保存されます。</p><p>「始める」をクリックしてゲーム開始です。</p><p><a class=\"squiffy-link link-section\" data-section=\"q0\" role=\"link\" tabindex=\"0\">{ActionSpan}始める</span></a></p>",
		'attributes': ["score=0","ActionSpan=<span class=\"actionSpan\" style=\"display: inline-block; border: 0.125em solid #E8FF00; border-radius: 0.25em; padding: 0.25em\">","NameSpan=<span class=\"nameSpan\" style=\"font-weight: bold\">"],
		'passages': {
		},
	},
	'q0': {
		'clear': true,
		'text': "<p>{scoreboard}\n<img src=\"./halfening/logojp.svg\" style=\"width: 100%; height: auto;\">\n{NameSpan}キャンディー</span>\n（自称）インターネット史上最も手がかかったクイズゲーム『乱雑学 Presents ハンハンター』、始まるよ〜！ 私は進行役でMCの<ruby>漆真下<rp>(</rp><rt>うるしまっか</rt><rp>)</rp></ruby>奏、キャンディーと呼んでね。</p><p><a class=\"squiffy-link link-section\" data-section=\"_continue1\" role=\"link\" tabindex=\"0\">{ActionSpan}続き</span></a></p>",
		'passages': {
		},
	},
	'_continue1': {
		'text': "<p>{NameSpan}キャンディー</span>\nルールは簡単。これからマルバツクイズの問題が5問出題されるから、必ずマルかバツかどっちか選んでね。</p><p><a class=\"squiffy-link link-section\" data-section=\"_continue2\" role=\"link\" tabindex=\"0\">{ActionSpan}続き</span></a></p>",
		'passages': {
		},
	},
	'_continue2': {
		'text': "<p>{NameSpan}キャンディー</span>\n正解したら（空想の）一万円ゲット、不正解だったら一万円没収するよ。</p><p><a class=\"squiffy-link link-section\" data-section=\"_continue3\" role=\"link\" tabindex=\"0\">{ActionSpan}続き</span></a></p>",
		'passages': {
		},
	},
	'_continue3': {
		'text': "<p>{NameSpan}キャンディー</span>\n心の準備はできた？ それじゃあ始めるよ。</p><p><a class=\"squiffy-link link-section\" data-section=\"q1\" role=\"link\" tabindex=\"0\">{ActionSpan}始め</a></p>",
		'passages': {
		},
	},
	'q1': {
		'clear': true,
		'text': "<p>{scoreboard}</p><p>{NameSpan}キャンディー</span>\n最初はこの問題。</p><p><h3>Q1: 作者の死、文字通り</h3>\n<a class=\"squiffy-link link-section\" data-section=\"_continue4\" role=\"link\" tabindex=\"0\">{ActionSpan}続き</span></a></p>",
		'passages': {
		},
	},
	'_continue4': {
		'text': "<p>{NameSpan}キャンディー</span> 普通「作者の死」って言うと文学用語で文字通りじゃないんだけど、この問題では今から4世紀以上前の世界を生きた著者のことを聞いてみるよ。〈ロメオとジュリエット〉を書いたウィリアム・シェイクスピアと〈ドン・キホーテ〉を書いたミゲル・デ・セルバンテスの二人。</p><p><a class=\"squiffy-link link-section\" data-section=\"_continue5\" role=\"link\" tabindex=\"0\">{ActionSpan}続き</span></a></p>",
		'passages': {
		},
	},
	'_continue5': {
		'text': "<blockquote>\nシェイクスピアとセルバンテスは没年月日が同じ。\n</blockquote>\n\n<p><a class=\"squiffy-link link-section\" data-section=\"q1t\" role=\"link\" tabindex=\"0\">{ActionSpan}⭕</span></a>か<a class=\"squiffy-link link-section\" data-section=\"q1f\" role=\"link\" tabindex=\"0\">{ActionSpan}❌</span></a>か？</p>",
		'passages': {
		},
	},
	'q1t': {
		'clear': true,
		'text': "<p>{scoreboard}\n<h3>残念！</h3>{NameSpan}キャンディー</span>\nセルバンテスの命日は、シェイクスピアの10日前だよ。</p><p><a class=\"squiffy-link link-section\" data-section=\"_continue6\" role=\"link\" tabindex=\"0\">{ActionSpan}続き</span></a></p>",
		'attributes': ["score-=10000"],
		'passages': {
		},
	},
	'_continue6': {
		'text': "<p>{NameSpan}キャンディー</span>\nシェイクスピアもセルバンテスもそれぞれの言語を象徴する作家っていうのは同じなんだけど、シェイクスピアは劇作家でセルバンテスは小説家だし、全然違うところの方が多いよね。</p><p><a class=\"squiffy-link link-section\" data-section=\"q2\" role=\"link\" tabindex=\"0\">{ActionSpan}続き</span></a></p>",
		'passages': {
		},
	},
	'q1f': {
		'clear': true,
		'text': "<p>{scoreboard}\n<h3>残念！</h3>{NameSpan}キャンディー</span>\n両方1616年4月23日没だよ。</p><p><a class=\"squiffy-link link-section\" data-section=\"_continue7\" role=\"link\" tabindex=\"0\">{ActionSpan}続き</span></a></p>",
		'attributes': ["score-=10000"],
		'passages': {
		},
	},
	'_continue7': {
		'text': "<p>{NameSpan}キャンディー</span>\n1995年に世界遺産で有名なユネスコが「世界本の日」を4月23日にしたのはこの偶然があったから。</p><p><a class=\"squiffy-link link-section\" data-section=\"q2\" role=\"link\" tabindex=\"0\">{ActionSpan}続き</span></a></p>",
		'passages': {
		},
	},
	'q2': {
		'clear': true,
		'text': "<p>{scoreboard}</p><p>{NameSpan}キャンディー</span>\nお次はこれ。</p><p><h3>Q2: ドイツの車が好みに<ruby>Auto<rp>（</rp><rt>アウト</rt><rp>）</rp></ruby>良いね</h3>\n<a class=\"squiffy-link link-section\" data-section=\"_continue8\" role=\"link\" tabindex=\"0\">{ActionSpan}続き</span></a></p>",
		'passages': {
		},
	},
	'_continue8': {
		'text': "<p>{NameSpan}キャンディー</span>\nベルリン一回は行ってみたいなー。ブランデンブルク門とか、国会議事堂とか、<a href=\"https://ja.wikipedia.org/wiki/%E3%83%99%E3%83%AB%E3%83%AA%E3%83%B3%E3%83%BB%E3%83%96%E3%83%A9%E3%83%B3%E3%83%87%E3%83%B3%E3%83%96%E3%83%AB%E3%82%AF%E5%9B%BD%E9%9A%9B%E7%A9%BA%E6%B8%AF\">開くまで14年間かかった空港</a>とかあるじゃん。ただ、下戸だからドイツのビールは遠慮しておこう。</p><p><a class=\"squiffy-link link-section\" data-section=\"_continue9\" role=\"link\" tabindex=\"0\">{ActionSpan}続き</span></a></p>",
		'passages': {
		},
	},
	'_continue9': {
		'text': "<blockquote>\n運転中、先の道に野生動物が見えたら<ruby>umfahren<rp>（</rp><rt>ウムファーレン</rt><rp>）</rp></ruby>するべき。\n</blockquote>\n\n<p><a class=\"squiffy-link link-section\" data-section=\"q2t\" role=\"link\" tabindex=\"0\">{ActionSpan}⭕</span></a>か<a class=\"squiffy-link link-section\" data-section=\"q2f\" role=\"link\" tabindex=\"0\">{ActionSpan}❌</span></a>か？</p>",
		'passages': {
		},
	},
	'q2t': {
		'clear': true,
		'text': "<p>{scoreboard}<h3>残念！</h3>{NameSpan}キャンディー</span>\nわざと轢くなんてひどいよ！</p><p><a class=\"squiffy-link link-section\" data-section=\"_continue10\" role=\"link\" tabindex=\"0\">{ActionSpan}続き</span></a></p>",
		'attributes': ["score-=10000"],
		'passages': {
		},
	},
	'_continue10': {
		'text': "<p>{NameSpan}キャンディー</span>\n<ruby>umfahren<rp>（</rp><rt>ウムファーレン</rt><rp>）</rp></ruby>は、「車などで轢く」という意味。</p><p>二問連続不正解なんて、ツいてないね～。三度目の正直、正解したいね。</p><p><a class=\"squiffy-link link-section\" data-section=\"q3\" role=\"link\" tabindex=\"0\">{ActionSpan}続き</span></a></p>",
		'passages': {
		},
	},
	'q2f': {
		'clear': true,
		'text': "<p>{scoreboard}<h3>残念！</h3>{NameSpan}キャンディー</span>\nよけなくちゃだめでしょ！</p><p><a class=\"squiffy-link link-section\" data-section=\"_continue11\" role=\"link\" tabindex=\"0\">{ActionSpan}続き</span></a></p>",
		'attributes': ["score-=10000"],
		'passages': {
		},
	},
	'_continue11': {
		'text': "<p>{NameSpan}キャンディー</span>\n<ruby>umfahren<rp>（</rp><rt>ウムファーレン</rt><rp>）</rp></ruby>は、「車などで<ruby>避<rp>（</rp><rt>よ</rt><rp>）</rp></ruby>けて運転する」という意味。</p><p>二問連続不正解なんて、ツいてないね～。三度目の正直、正解したいね。</p><p><a class=\"squiffy-link link-section\" data-section=\"q3\" role=\"link\" tabindex=\"0\">{ActionSpan}続き</span></a></p>",
		'passages': {
		},
	},
	'q3': {
		'clear': true,
		'text': "<p>{scoreboard}</p><p>{NameSpan}キャンディー</span>\nこれはどうかな？</p>\n<h3>Q3: 石の上にも3問</h3>\n\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue12\" role=\"link\" tabindex=\"0\">{ActionSpan}続き</span></a></p>",
		'passages': {
		},
	},
	'_continue12': {
		'text': "<p>{NameSpan}キャンディー</span>\nことわざって世界中にいろいろあるよね。「転がる石には苔生えぬ」なんて、何千年前からずっとあることわざなんだって。</p><p><a class=\"squiffy-link link-section\" data-section=\"_continue13\" role=\"link\" tabindex=\"0\">{ActionSpan}続き</span></a></p>",
		'passages': {
		},
	},
	'_continue13': {
		'text': "<blockquote>\n「転がる石には苔生えぬ」とは、色々試してみるべきだという意味。\n</blockquote>\n\n<p><a class=\"squiffy-link link-section\" data-section=\"q3t\" role=\"link\" tabindex=\"0\">{ActionSpan}⭕</span></a>か<a class=\"squiffy-link link-section\" data-section=\"q3f\" role=\"link\" tabindex=\"0\">{ActionSpan}❌</span></a>か？</p>",
		'passages': {
		},
	},
	'q3t': {
		'clear': true,
		'text': "<p>{scoreboard}<h3>残念！</h3>{NameSpan}キャンディー</span>\n全然違う！ どこか一箇所に住み着いて何かの道を極めないといけないという意味だよ。</p><p><a class=\"squiffy-link link-section\" data-section=\"_continue14\" role=\"link\" tabindex=\"0\">{ActionSpan}続き</span></a></p>",
		'attributes': ["score-=10000"],
		'passages': {
		},
	},
	'_continue14': {
		'text': "<p>{NameSpan}キャンディー</span>\n一か所にとどまって、キャリアとか家庭とか築かないと将来大変だぞ、っていう耳が痛い忠告。</p><p><a class=\"squiffy-link link-section\" data-section=\"q4\" role=\"link\" tabindex=\"0\">{ActionSpan}続き</span></a></p>",
		'passages': {
		},
	},
	'q3f': {
		'clear': true,
		'text': "<p>{scoreboard}<h3>残念！</h3>{NameSpan}キャンディー</span>\nいやいや、この意味で合ってるよ。</p><p><a class=\"squiffy-link link-section\" data-section=\"_continue15\" role=\"link\" tabindex=\"0\">{ActionSpan}続き</span></a></p>",
		'attributes': ["score-=10000"],
		'passages': {
		},
	},
	'_continue15': {
		'text': "<p>{NameSpan}キャンディー</span>\n雑誌「ローリング・ストーン」とかバンド名の「ローリング・ストーンズ」とかにあるように、「転がる石」っていうのは色々な所に移って色々なスキルを身に着けた知識人っていう意味。</p><p><a class=\"squiffy-link link-section\" data-section=\"q4\" role=\"link\" tabindex=\"0\">{ActionSpan}続き</span></a></p>",
		'passages': {
		},
	},
	'q4': {
		'clear': true,
		'text': "<p>{scoreboard}</p><p>{NameSpan}キャンディー</span>\n次の問題に温かい声援をお願いしま～す！</p>\n<h3>Q4: 日本の、お茶好きで元帝国の島国仲間、イギリス</h3>\n\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue16\" role=\"link\" tabindex=\"0\">{ActionSpan}続き</span></a></p>",
		'passages': {
		},
	},
	'_continue16': {
		'text': "<p>{NameSpan}キャンディー</span>\n三問連続で間違うなんてどうしちゃったのさ？ わざとじゃないよね？</p><p><a class=\"squiffy-link link-section\" data-section=\"_continue17\" role=\"link\" tabindex=\"0\">{ActionSpan}続き</span></a></p>",
		'passages': {
		},
	},
	'_continue17': {
		'text': "<blockquote>\nイギリスの海岸の長さは1万6千キロメートル以上。 \n</blockquote>\n\n\n<p><a class=\"squiffy-link link-section\" data-section=\"q4t\" role=\"link\" tabindex=\"0\">{ActionSpan}⭕</span></a>か<a class=\"squiffy-link link-section\" data-section=\"q4f\" role=\"link\" tabindex=\"0\">{ActionSpan}❌</span></a>か？</p>",
		'passages': {
		},
	},
	'q4t': {
		'clear': true,
		'text': "<p>{scoreboard}<h3>残念！</h3>{NameSpan}キャンディー</span>\nCIAのファクトブックには、イギリスの海岸の長さは12500キロぐらいしか無いって書いてあるよ。</p><p><a class=\"squiffy-link link-section\" data-section=\"_continue18\" role=\"link\" tabindex=\"0\">{ActionSpan}続き</span></a></p>",
		'attributes': ["score-=10000"],
		'passages': {
		},
	},
	'_continue18': {
		'text': "<p>{NameSpan}キャンディー</span>\nこれで5問中4問間違えたってことだけど、最後の問題だけは正解できないと恥ずかしいね。これは頑張らないと。 </p><p><a class=\"squiffy-link link-section\" data-section=\"q5\" role=\"link\" tabindex=\"0\">{ActionSpan}続き</span></a></p>",
		'passages': {
		},
	},
	'q4f': {
		'clear': true,
		'text': "<p>{scoreboard}<h3>残念！</h3>{NameSpan}キャンディー</span>\n世界資源研究所いわく、イギリスの海岸の長さは2万キロ弱なんだって！</p><p><a class=\"squiffy-link link-section\" data-section=\"_continue19\" role=\"link\" tabindex=\"0\">{ActionSpan}続き</span></a></p>",
		'attributes': ["score-=10000"],
		'passages': {
		},
	},
	'_continue19': {
		'text': "<p>{NameSpan}キャンディー</span>\nこれで5問中4問間違えたってことだけど、最後の問題だけは正解できないと恥ずかしいね。これは頑張らないと。</p><p><a class=\"squiffy-link link-section\" data-section=\"q5\" role=\"link\" tabindex=\"0\">{ActionSpan}続き</span></a></p>",
		'passages': {
		},
	},
	'q5': {
		'clear': true,
		'text': "<p>{scoreboard}</p><p>{NameSpan}キャンディー</span>\n次のタイトルは・・・</p><p><h3>Q5: 洋楽学</h3>\n<a class=\"squiffy-link link-section\" data-section=\"_continue20\" role=\"link\" tabindex=\"0\">{ActionSpan}続き</span></a></p>",
		'passages': {
		},
	},
	'_continue20': {
		'text': "<p>{NameSpan}キャンディー</span>\n最後の問題は、カナダの歌手の洋楽の歌詞の問題。知らなくてもあてずっぽうに選んだら半々の確率で正解できるからファイトだ！</p><p><a class=\"squiffy-link link-section\" data-section=\"_continue21\" role=\"link\" tabindex=\"0\">{ActionSpan}続き</span></a></p>",
		'passages': {
		},
	},
	'_continue21': {
		'text': "<blockquote>\nアラニス・モリセットの曲〈<ruby>Ironic<rp>（</rp><rt>アイロニック</rt><rp>）</rp></ruby>〉の歌詞には、「皮肉な出来事」の正しい例は一つもない。\n</blockquote>\n\n<p><a class=\"squiffy-link link-section\" data-section=\"q5t\" role=\"link\" tabindex=\"0\">{ActionSpan}⭕</span></a>か<a class=\"squiffy-link link-section\" data-section=\"q5f\" role=\"link\" tabindex=\"0\">{ActionSpan}❌</span></a>か？</p>",
		'passages': {
		},
	},
	'q5t': {
		'clear': true,
		'text': "<p>{scoreboard}<h3>残念！</h3>{NameSpan}キャンディー</span>\n皮肉っていうのは、予期していた出来事と正反対のことが起きたときのことだから、全部ではないけど正しい例は数個あるよ。</p><p><a class=\"squiffy-link link-section\" data-section=\"_continue22\" role=\"link\" tabindex=\"0\">{ActionSpan}続き</span></a></p>",
		'attributes': ["score-=10000"],
		'passages': {
		},
	},
	'_continue22': {
		'text': "<p>{NameSpan}キャンディー</span>\n例えば、98歳のおじいさんが宝くじで大当たりしたら、人生ガラッと変わっちゃうと思うじゃん？ でも次の日死んじゃったって歌詞の最初に言ってある。れっきとした皮肉だよね。</p><p><a class=\"squiffy-link link-section\" data-section=\"end\" role=\"link\" tabindex=\"0\">{ActionSpan}続き</span></a></p>",
		'passages': {
		},
	},
	'q5f': {
		'clear': true,
		'text': "<p>{scoreboard}<h3>残念！</h3>{NameSpan}キャンディー</span>\nリリースしてからずっと、歌詞の内容が全然皮肉じゃないって叩かれ続けている曲なんだよ。「もうお金を払ったのに、タダで車で送ってもらうとき」は皮肉じゃなくて替え。</p><p><a class=\"squiffy-link link-section\" data-section=\"_continue23\" role=\"link\" tabindex=\"0\">{ActionSpan}続き</span></a></p>",
		'attributes': ["score-=10000"],
		'passages': {
		},
	},
	'_continue23': {
		'text': "<p>{NameSpan}キャンディー</span>\nアラニスさん本人も2015年のテレビ出演で自虐ネタを披露したことがあるぐらい、文学バカの間ではよく知られてる曲だよ。</p><p><a class=\"squiffy-link link-section\" data-section=\"end\" role=\"link\" tabindex=\"0\">{ActionSpan}続き</span></a></p>",
		'passages': {
		},
	},
	'end': {
		'clear': true,
		'text': "<p>{scoreboard}</p><p>{NameSpan}キャンディー</span>\nこれで5問全部終わり！ 正しく答えられたのは5問中・・・0問だね。珍しいね、ランダムに選んで全部不正解っていうのは32分の1の確率だよ。</p><p><a class=\"squiffy-link link-section\" data-section=\"syke\" role=\"link\" tabindex=\"0\">{ActionSpan}続き</span></a></p>",
		'passages': {
		},
	},
	'syke': {
		'clear': true,
		'text': "<p>{scoreboard}</p>\n<h3>ドッキリ大成功!!</h3>\n\n<p>{NameSpan}キャンディー</span>\nなんちゃって〜！このクイズの問題は全部解釈によってマルでもバツでもある問題なんだよ。君が選んでから、選んでないほうが正解って私が決めただけで、君は全然悪くないよ。</p><p><a class=\"squiffy-link link-section\" data-section=\"_continue24\" role=\"link\" tabindex=\"0\">{ActionSpan}コノヤロー!!</span></a></p>",
		'attributes': ["score=0"],
		'passages': {
		},
	},
	'_continue24': {
		'text': "<p>{NameSpan}キャンディー</span>\nどういう仕組みでマルでもバツでも正解な問題ができたか、解説してあげるね。参加ありがとう！</p><p><a class=\"squiffy-link link-section\" data-section=\"commentary\" role=\"link\" tabindex=\"0\">{ActionSpan}ほうほう・・・</span></a></p>",
		'passages': {
		},
	},
	'commentary': {
		'clear': true,
		'text': "<p><blockquote>\nシェイクスピアとセルバンテスは没年月日が同じ。\n</blockquote>\n<b>⭕でも❌でもあるのはどうして？</b>\n今私達が使っている暦、グレゴリオ暦は、1582年にローマ教皇グレゴリウス3世が発表した物。カトリックな国であったスペインはすぐ使い始めたんだけど、プロテスタントな国であったイギリスは、1752年までユリウス暦を使い続けていたんだって。だからシェイクスピアの命日はユリウス暦では1616/04/23だけど、グレゴリオ暦に直すと1616/05/03になる。</p><p><blockquote>\n運転中、先の道に野生動物が見えたら<ruby>umfahren<rp>（</rp><rt>ウムファーレン</rt><rp>）</rp></ruby>するべき。\n</blockquote>\n<b>⭕でも❌でもあるのはどうして？</b>\nアクセント（強勢）が um に付いている場合、「轢く」という意味なんだけど、アクセントが fahr に付いていたら、「<ruby>避<rp>（</rp><rt>よ</rt><rp>）</rp></ruby>けて運転する」っていう意味になる。難しいけど、日本語での「柿が、牡蠣が、垣が」みたいな物と思っておけばいいっしょ。</p><p><blockquote>\n「転がる石には苔生えぬ」とは、色々試してみるべきだという意味。\n</blockquote>\n<b>⭕でも❌でもあるのはどうして？</b>\n元々の意味は「一か所にとどまらないと成長できないぞ」という意味なんだけど、1950年代のアメリカで「アクティブにいろいろな場所でいろいろ試さないと成長できないぞ」という真逆の意味も付いちゃったんだって。日本語での「犬も歩けば棒に当たる」と似たような現象だね。</p><p><blockquote>\nイギリスの海岸の長さは1万6千キロメートル以上。 \n</blockquote>\n<b>⭕でも❌でもあるのはどうして？</b>\n海岸線には、細かいジグザグがあって、どれだけ細かく計測するかで海岸線の長さが大きく変わっちゃうの。CIAのファクトブックによれば12429キロメートルだけど、世界資源研究所（<a href=\"https://en.wikipedia.org/wiki/World_Resources_Institute\">World Resources Institute</a>）によれば19717キロメートル。かなりのブレでしょ？　この現象は「<a href=\"https://ja.wikipedia.org/wiki/%E6%B5%B7%E5%B2%B8%E7%B7%9A%E3%81%AE%E3%83%91%E3%83%A9%E3%83%89%E3%83%83%E3%82%AF%E3%82%B9\">海岸線のパラドックス</a>」って呼ばれてて、肺の内部の表面積がどれくらいなのか諸説あるのも同じ原理。</p><p><blockquote>\nアラニス・モリセットの曲〈<ruby>Ironic<rp>（</rp><rt>アイロニック</rt><rp>）</rp></ruby>〉の歌詞には、「皮肉な出来事」の正しい例は一つもない。\n</blockquote>\n<b>⭕でも❌でもあるのはどうして？</b>\n何が皮肉かっていうのは、意見によるところもある。歌詞にあるほとんどの「皮肉な出来事」のほとんど（結婚式に雨が降るとか）は全然皮肉じゃないけど、読み手の読み解き方によっては、充分皮肉に感じるものもあるよ。（人生がガラッと変わる大金が当たった老人が、当たったお金を使える前に死んじゃうとか）</p><p><a class=\"squiffy-link link-section\" data-section=\"_continue25\" role=\"link\" tabindex=\"0\">{ActionSpan}続き</span></a></p>",
		'passages': {
		},
	},
	'_continue25': {
		'text': "<p>このゲームは『<a href=\"https://haitouch.ga/me/salty\">乱雑学</a>』のスピンオフ作品です。\n『乱雑学』とは、フルボイスの雑学ゲームで、一問一問にユニークなひねりがかかっていて、正解が分からなくても、かこつけられたポップカルチャーネタやダジャレを聴いているだけで面白いように出来ています。ネット通話を通じて世界のどこの人とでも対戦できます！</p><p>日本語版の制作はまだ開始されていませんが、英語版は公開されていて、更新もあと三回予定されています。日本語版に興味がある方や、興味がありそうな知り合いがいる方は、<a href=\"https://discord.gg/5dwvxGuM7X\">はい!タッチスタジオ公式Discordサーバー</a>にお越しください！ 製作スタッフ募集中です。</p><p>現在公開されている英語版の体験版のプレイ動画には、日本語字幕がつけられているので、待ちきれない方は是非ご覧ください。</p>\n<div class=\"embedAspectRatio\"><iframe width=\"640\" height=\"360\" src=\"https://www.youtube.com/embed/ntVW028HXKQ\" title=\"Salty Trivia gameplay\" frameborder=\"0\" allow=\"clipboard-write; encrypted-media;picture-in-picture; web-share\" allowfullscreen></iframe></div>\n\n<p><h3>プレイありがとうございました！</h3></p>\n<hr>",
		'passages': {
		},
	},
}
})();