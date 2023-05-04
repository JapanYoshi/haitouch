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
            if (!squiffy.ui.settings.restartPrompt || confirm('Are you sure you want to restart?')) {
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
squiffy.story.id = '133cd6cac4';
squiffy.story.sections = {
	'scoreboard': {
		'text': "<p><span class=\"scoreboard\" style=\"display: block; background: black; color: white; text-align: center; padding: 0.5em 0;\">Score: ${score}</span></p>",
		'passages': {
		},
	},
	'mainmenu': {
		'text': "<p>{scoreboard}\n“Salty Trivia: The Halfening” is a minigame spin-off of the trivia game <a href=\"https://haitouch.ga/me/salty\">“Salty Trivia with Candy Barre”</a>. It’s a fully-voiced, interactive, sassy trivia game for up to 8 players that you can even play online over voice chat!</p>\n<p>Squiffy will automatically save your progress throughout the game.</p>\n<p>Press “start” to start the show.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"q0\" role=\"link\" tabindex=\"0\">{ActionSpan}Start</span></a></p>",
		'attributes': ["score=0","ActionSpan=<span class=\"actionSpan\" style=\"display: inline-block; border: 0.125em solid #E8FF00; border-radius: 0.25em; padding: 0.25em\">","NameSpan=<span class=\"nameSpan\" style=\"font-weight: bold\">"],
		'passages': {
		},
	},
	'q0': {
		'clear': true,
		'text': "<p>{scoreboard}\n<img src=\"./halfening/logo.png\" style=\"width: 100%; height: auto;\">\n{NameSpan}Candy:</span>\nWelcome to <b>Salty Trivia: The Halfening</b>: the self-proclaimed funniest trivia minigame on the Internet!</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue1\" role=\"link\" tabindex=\"0\">{ActionSpan}Continue</span></a></p>",
		'passages': {
		},
	},
	'_continue1': {
		'text': "<p>{NameSpan}Candy:</span>\nThe rules are simple. I’m gonna ask you 5 true-or-false questions, and you have to choose the right answer. You have no time limit, nor will you be kicked out of the game for answering wrong, but you have to choose either true or false to advance.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue2\" role=\"link\" tabindex=\"0\">{ActionSpan}Continue</span></a></p>",
		'passages': {
		},
	},
	'_continue2': {
		'text': "<p>{NameSpan}Candy:</span>\nFor every right answer, I’ll give you 1000 virtual dollars. But for every wrong answer, I’ll take that much away.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue3\" role=\"link\" tabindex=\"0\">{ActionSpan}Continue</span></a></p>",
		'passages': {
		},
	},
	'_continue3': {
		'text': "<p>{NameSpan}Candy:</span>\nReady to play? Yeah, me too. Let’s begin.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"q1\" role=\"link\" tabindex=\"0\">{ActionSpan}Start</a></p>",
		'passages': {
		},
	},
	'q1': {
		'clear': true,
		'text': "<p>{scoreboard}</p>\n<p>{NameSpan}Candy:</span> Let’s start this off with...</p>\n<p><h3>Q1: Death of the Author, Literally</h3>\n<a class=\"squiffy-link link-section\" data-section=\"_continue4\" role=\"link\" tabindex=\"0\">{ActionSpan}Continue</span></a></p>",
		'passages': {
		},
	},
	'_continue4': {
		'text': "<p>{NameSpan}Candy:</span> “Death of the Author” is usually a figure of speech, but this question is about two authors who literally died over 4 centuries ago. William Shakespeare, author of <i>Romeo and Juliet</i>, and Miguel de Cervantes, author of <i>Don Quixote</i>.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue5\" role=\"link\" tabindex=\"0\">{ActionSpan}Continue</span></a></p>",
		'passages': {
		},
	},
	'_continue5': {
		'text': "<blockquote>\nWilliam Shakespeare and Miguel de Cervantes died on the same date.\n</blockquote>\n\n<p><a class=\"squiffy-link link-section\" data-section=\"q1t\" role=\"link\" tabindex=\"0\">{ActionSpan}True</span></a> or \n<a class=\"squiffy-link link-section\" data-section=\"q1f\" role=\"link\" tabindex=\"0\">{ActionSpan}False</span></a>?</p>",
		'passages': {
		},
	},
	'q1t': {
		'clear': true,
		'text': "<p>{scoreboard}\n{NameSpan}Candy:</span> Nope, Cervantes died 10 days before Shakespeare died.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue6\" role=\"link\" tabindex=\"0\">{ActionSpan}Continue</span></a></p>",
		'attributes': ["score-=1000"],
		'passages': {
		},
	},
	'_continue6': {
		'text': "<p>{NameSpan}Candy:</span>\nAlthough they’re both regarded as the author symbolizing the formation of their respective language, another difference is that Shakespeare wrote plays while Cervantes wrote novels.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"q2\" role=\"link\" tabindex=\"0\">{ActionSpan}Continue</span></a></p>",
		'passages': {
		},
	},
	'q1f': {
		'clear': true,
		'text': "<p>{scoreboard}\n{NameSpan}Candy:</span> Yes, they both died in 1616, on April 23.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue7\" role=\"link\" tabindex=\"0\">{ActionSpan}Continue</span></a></p>",
		'attributes': ["score-=1000"],
		'passages': {
		},
	},
	'_continue7': {
		'text': "<p>{NameSpan}Candy:</span>\nThis coincidence led UNESCO to commemorate April 23 as “World Book Day” in 1995, the same year <i>You Don’t Know Jack</i> was first released.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"q2\" role=\"link\" tabindex=\"0\">{ActionSpan}Continue</span></a></p>",
		'passages': {
		},
	},
	'q2': {
		'clear': true,
		'text': "<p>{scoreboard}</p>\n<p>{NameSpan}Candy:</span> Coming up next:</p>\n<p><h3>Q2: The Autobahn to Hell is Paved with Good Intentions</h3>\n<a class=\"squiffy-link link-section\" data-section=\"_continue8\" role=\"link\" tabindex=\"0\">{ActionSpan}Continue</span></a></p>",
		'passages': {
		},
	},
	'_continue8': {
		'text': "<p>{NameSpan}Candy:</span> Y’know, one place I really wanna visit someday is Berlin, Germany. Brandenburg Gate, the Reichstag, <a href=\"https://en.wikipedia.org/wiki/Berlin_Brandenburg_Airport\">that airport that took 14 years to open</a>, lots of other places with cultural significance. It’s just a shame that my liver won’t let me enjoy the local beer.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue9\" role=\"link\" tabindex=\"0\">{ActionSpan}Continue</span></a></p>",
		'passages': {
		},
	},
	'_continue9': {
		'text': "<blockquote>\nWhen you see wild frogs or toads while driving in Germany, you should „umfahren“ it.\n</blockquote>\n\n<p><a class=\"squiffy-link link-section\" data-section=\"q2t\" role=\"link\" tabindex=\"0\">{ActionSpan}True</span></a> or \n<a class=\"squiffy-link link-section\" data-section=\"q2f\" role=\"link\" tabindex=\"0\">{ActionSpan}False</span></a>?</p>",
		'passages': {
		},
	},
	'q2t': {
		'clear': true,
		'text': "<p>{scoreboard}\n{NameSpan}Candy:</span> No, you shouldn’t run that poor frog over!</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue10\" role=\"link\" tabindex=\"0\">{ActionSpan}Continue</span></a></p>",
		'attributes': ["score-=1000"],
		'passages': {
		},
	},
	'_continue10': {
		'text': "<p>{NameSpan}Candy:</span>\nUmfahren means “to run over” something. Hopefully you won’t crash and burn on the next question. As well.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"q3\" role=\"link\" tabindex=\"0\">{ActionSpan}Continue</span></a></p>",
		'passages': {
		},
	},
	'q2f': {
		'clear': true,
		'text': "<p>{scoreboard}\n{NameSpan}Candy:</span> Yes you should avoid that poor frog!</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue11\" role=\"link\" tabindex=\"0\">{ActionSpan}Continue</span></a></p>",
		'attributes': ["score-=1000"],
		'passages': {
		},
	},
	'_continue11': {
		'text': "<p>{NameSpan}Candy:</span>\nUmfahren means “to drive or sail around” something. Hopefully, you won’t drive or sail around the right answer next time.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"q3\" role=\"link\" tabindex=\"0\">{ActionSpan}Continue</span></a></p>",
		'passages': {
		},
	},
	'q3': {
		'clear': true,
		'text': "<p>{scoreboard}</p>\n<p>{NameSpan}Candy:</span> Can you handle this?</p>\n<h3>Q3: I’d Rather Not Walk 5,000 Miles More</h3>\n\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue12\" role=\"link\" tabindex=\"0\">{ActionSpan}Continue</span></a></p>",
		'passages': {
		},
	},
	'_continue12': {
		'text': "<p>{NameSpan}Candy:</span> Quite the unlucky streak you’re racking up. Care to press your luck on this next one?</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue13\" role=\"link\" tabindex=\"0\">{ActionSpan}Continue</span></a></p>",
		'passages': {
		},
	},
	'_continue13': {
		'text': "<blockquote>\nThe UK has more than 16,000&nbsp;km (10,000&nbsp;mi) of coastline.\n</blockquote>\n\n<p><a class=\"squiffy-link link-section\" data-section=\"q3t\" role=\"link\" tabindex=\"0\">{ActionSpan}True</span></a> or \n<a class=\"squiffy-link link-section\" data-section=\"q3f\" role=\"link\" tabindex=\"0\">{ActionSpan}False</span></a>?</p>",
		'passages': {
		},
	},
	'q3t': {
		'clear': true,
		'text': "<p>{scoreboard}\n{NameSpan}Candy:</span> Don’t be so preposterous; the CIA Factbook says that the UK only has 12 and a half thousand kilometers of coastline.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue14\" role=\"link\" tabindex=\"0\">{ActionSpan}Continue</span></a></p>",
		'attributes': ["score-=1000"],
		'passages': {
		},
	},
	'_continue14': {
		'text': "<p>{NameSpan}Candy:</span>\nWow, that makes 3 wrong answers in a row! And for true-or-false questions, no less! Are you sure you’re not throwing the game intentionally?</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"q4\" role=\"link\" tabindex=\"0\">{ActionSpan}Continue</span></a></p>",
		'passages': {
		},
	},
	'q3f': {
		'clear': true,
		'text': "<p>{scoreboard}\n{NameSpan}Candy:</span> On the contrary, my dear Watson; the World Resources Institute says that the UK has almost 20 thousand kilometers of coastline!</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue15\" role=\"link\" tabindex=\"0\">{ActionSpan}Continue</span></a></p>",
		'attributes': ["score-=1000"],
		'passages': {
		},
	},
	'_continue15': {
		'text': "<p>{NameSpan}Candy:</span>\nWow, that makes 3 wrong answers in a row! And for true-or-false questions, no less! Are you sure you’re not throwing the game intentionally?</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"q4\" role=\"link\" tabindex=\"0\">{ActionSpan}Continue</span></a></p>",
		'passages': {
		},
	},
	'q4': {
		'clear': true,
		'text': "<p>{scoreboard}</p>\n<p>{NameSpan}Candy:</span> Please welcome:</p>\n<h3>Q4: It’s Like a Free Trivia Game when You’ve Already Paid</h3>\n\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue16\" role=\"link\" tabindex=\"0\">{ActionSpan}Continue</span></a></p>",
		'passages': {
		},
	},
	'_continue16': {
		'text': "<p>{NameSpan}Candy:</span> You know what I really like? Songs about literary devices.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue17\" role=\"link\" tabindex=\"0\">{ActionSpan}Continue</span></a></p>",
		'passages': {
		},
	},
	'_continue17': {
		'text': "<blockquote>\nThe song <i>Ironic</i> by Alanis Morissette actually contains irony.\n</blockquote>\n\n<p><a class=\"squiffy-link link-section\" data-section=\"q4t\" role=\"link\" tabindex=\"0\">{ActionSpan}True</span></a> or \n<a class=\"squiffy-link link-section\" data-section=\"q4f\" role=\"link\" tabindex=\"0\">{ActionSpan}False</span></a>?</p>",
		'passages': {
		},
	},
	'q4t': {
		'clear': true,
		'text': "<p>{scoreboard}\n{NameSpan}Candy:</span> Uh, no. The song has been made fun of numerous times for not actually containing irony. For example, “A free ride when you’ve already paid” isn’t irony; it’s a replacement.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue18\" role=\"link\" tabindex=\"0\">{ActionSpan}Continue</span></a></p>",
		'attributes': ["score-=1000"],
		'passages': {
		},
	},
	'_continue18': {
		'text': "<p>{NameSpan}Candy:</span>\nEven Alanis Morissette herself performed the song live in 2015 with the extra lyrics “It’s like singing <i>Ironic</i> when there are no ironies”. Guess where? On that prick James Corden’s show.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"q5\" role=\"link\" tabindex=\"0\">{ActionSpan}Continue</span></a></p>",
		'passages': {
		},
	},
	'q4f': {
		'clear': true,
		'text': "<p>{scoreboard}\n{NameSpan}Candy:</span> Uh, yeah it does. The lyrics have a few valid examples of situational irony, which is when the event that happens is the exact opposite of what’s expected.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue19\" role=\"link\" tabindex=\"0\">{ActionSpan}Continue</span></a></p>",
		'attributes': ["score-=1000"],
		'passages': {
		},
	},
	'_continue19': {
		'text': "<p>{NameSpan}Candy:</span>\nFor example, you’d expect winning the lottery would change the 98-year-old man’s life! But the cosmic irony is that he had only a day to live. To quote Alanis, “Life has an odd way of sneaking up on you”. Or in this case, death does.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"q5\" role=\"link\" tabindex=\"0\">{ActionSpan}Continue</span></a></p>",
		'passages': {
		},
	},
	'q5': {
		'clear': true,
		'text': "<p>{scoreboard}</p>\n<p>{NameSpan}Candy:</span> Here’s your next category.</p>\n<p><h3>Q5: Don’t Let the Dog Walk You</h3>\n<a class=\"squiffy-link link-section\" data-section=\"_continue20\" role=\"link\" tabindex=\"0\">{ActionSpan}Continue</span></a></p>",
		'passages': {
		},
	},
	'_continue20': {
		'text': "<p>{NameSpan}Candy:</span> Alright, it’s the final question. Judging by the fact that, against all odds, you got all four of the previous questions wrong, maybe you should step up your game for this last one.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue21\" role=\"link\" tabindex=\"0\">{ActionSpan}Continue</span></a></p>",
		'passages': {
		},
	},
	'_continue21': {
		'text': "<blockquote>\nThe Japanese proverb meaning “A dog on a walk may get hit with a stick” encourages you to go out a lot.\n</blockquote>\n\n<p><a class=\"squiffy-link link-section\" data-section=\"q5t\" role=\"link\" tabindex=\"0\">{ActionSpan}True</span></a> or \n<a class=\"squiffy-link link-section\" data-section=\"q5f\" role=\"link\" tabindex=\"0\">{ActionSpan}False</span></a>?</p>",
		'passages': {
		},
	},
	'q5t': {
		'clear': true,
		'text': "<p>{scoreboard}\n{NameSpan}Candy:</span> No way. Why would a dog like getting hit by some guy with a stick?</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue22\" role=\"link\" tabindex=\"0\">{ActionSpan}Continue</span></a></p>",
		'attributes': ["score-=1000"],
		'passages': {
		},
	},
	'_continue22': {
		'text': "<p>{NameSpan}Candy:</span>\nBy “A dog on a walk may get hit with a stick”, they mean that screwing around and gathering attention only gets you hurt.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"end\" role=\"link\" tabindex=\"0\">{ActionSpan}Continue</span></a></p>",
		'passages': {
		},
	},
	'q5f': {
		'clear': true,
		'text': "<p>{scoreboard}\n{NameSpan}Candy:</span> Actually, modern examples show that it’s used to encourage being sociable, because you don’t know what nice things you’re going to come across.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue23\" role=\"link\" tabindex=\"0\">{ActionSpan}Continue</span></a></p>",
		'attributes': ["score-=1000"],
		'passages': {
		},
	},
	'_continue23': {
		'text': "<p>{NameSpan}Candy:</span>\nWhy would it be a good thing for a dog to get hit with a stick? No idea, but it sounds like a convenient excuse for the dog to play some catch.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"end\" role=\"link\" tabindex=\"0\">{ActionSpan}Continue</span></a></p>",
		'passages': {
		},
	},
	'end': {
		'clear': true,
		'text': "<p>{scoreboard}</p>\n<p>{NameSpan}Candy:</span> That’s all five questions! And you’ve gotten... none of them right. What a rare occurrence, right? Answering five fifty-fifties wrong in a row is a one-in-32 occurrence.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue24\" role=\"link\" tabindex=\"0\">{ActionSpan}Continue</span></a></p>",
		'passages': {
		},
	},
	'_continue24': {
		'text': "<h3>Gotcha!!</h3><p>{NameSpan}Candy:</span> <i><b>You got pranked!</b></i> All of these questions have been specifically designed so that the correct answer is either true or false, depending on your interpretation. I just always chose the one you didn’t choose, as a fun prank.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue25\" role=\"link\" tabindex=\"0\">{ActionSpan}God DAMN IT, CANDY!</span></a></p>",
		'passages': {
		},
	},
	'_continue25': {
		'text': "<p>{NameSpan}Candy:</span>\nWanna see how each answer could be both true and false? Here’s all the commentary as a consolation prize.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"commentary\" role=\"link\" tabindex=\"0\">{ActionSpan}I’m interested...</span></a></p>",
		'passages': {
		},
	},
	'commentary': {
		'clear': true,
		'text': "<p><blockquote>\nWilliam Shakespeake and Miguel de Cervantes died on the same date.\n</blockquote>\n<b>How can it be both?</b> Spain (being Catholic) adopted the Gregorian calendar (the one we use today) as soon as it was proposed in 1582, but Great Britain (being Protestant) stayed on the older Julian calendar until 1752. Shakespeare died on 1616 April 23 in the Julian calendar, which is 1616 May 3 in the Gregorian calendar.</p>\n<p><blockquote>\nTrue or false? When you see wild frogs or toads while driving in Germany, you should „umfahren“ it.\n</blockquote>\n<b>How can it be both?</b> The German word has two opposite meanings. When the accent is on the „um“, it means “to run over”, while when the accent is on the „fahr“, it means “to drive around”.</p>\n<p><blockquote>\nTrue or false? The UK has more than 16,000 km (10,000 mi) of coastline.\n</blockquote>\n<b>How can it be both?</b> Coastlines have minuscule, fractal-like details; the coarseness of the measurement has a big effect on the total length. The CIA Factbook says it’s 12,429 km (7,723 mi) long, but the World Resources Institute measured it with a finer ruler and got 19,717 km (12,252 mi). This is called <a href=\"https://en.wikipedia.org/wiki/Coastline_paradox\">the coastline paradox</a>, and it’s also the reason why different science books can’t agree on how much surface area your lungs have!</p>\n<p><blockquote>\nTrue or false? The song <i>Ironic</i> by Alanis Morissette actually contains irony.\n</blockquote>\n<b>How can it be both?</b> What is or isn’t irony is hard to pin down. While most of Alanis’ ironies aren’t ironic at all (e.g. rain on a wedding day), the reader might recognize an ironic underpinning behind some of the unfortunate situations (e.g. an old man winning life-changing amounts of money, then dying before he could spend any of it).</p>\n<p><blockquote>\nTrue or false? The Japanese proverb meaning “A dog on a walk may get hit with a stick” encourages you to go out a lot.\n</blockquote>\n<b>How can it be both?</b> The Japanese proverb <a href=\"https://en.wiktionary.org/wiki/%E7%8A%AC%E3%82%82%E6%AD%A9%E3%81%91%E3%81%B0%E6%A3%92%E3%81%AB%E5%BD%93%E3%81%9F%E3%82%8B\">犬も歩けば棒に当たる</a> originally meant to reprimand youngsters who just wouldn’t settle down. However, it has since also gained an opposite meaning promoting sociability! It’s like the English proverb “A rolling stone gathers no moss”.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue26\" role=\"link\" tabindex=\"0\">{ActionSpan}Continue</span></a></p>",
		'passages': {
		},
	},
	'_continue26': {
		'text': "<p>If you liked this game, you’d probably love <a href=\"https://haitouch.ga/me/salty\">Salty Trivia with Candy Barre</a>! It’s a fully-voiced sassy trivia game with cleverly phrased questions and loads of fun question types. It takes boring old trivia and spices it up with fun pop culture references. You can even play it with people on the other side of the Earth your preferred voice chat client!</p>\n<p>And here’s a trailer, since a video is worth a thousand words:</p>\n<div class='embedAspectRatio'><iframe width=\"640\" height=\"360\" src=\"https://www.youtube.com/embed/LMd3IIJZEoM\" title=\"Salty Trivia trailer\" frameborder=\"0\" allow=\"clipboard-write; encrypted-media;picture-in-picture; web-share\" allowfullscreen></iframe></div>\n\n<p><h3>Thanks for playing!</h3></p>\n<hr>",
		'passages': {
		},
	},
}
})();