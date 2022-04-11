var socket;
var webRtcPlayerObj = null;
var print_stats = false;
var print_inputs = false;
var connect_on_load = true;

var is_reconnection = false;
var ws;
const WS_OPEN_STATE = 1;

var qualityControlOwnershipCheckBox;
var matchViewportResolution;
// TODO: Remove this - workaround because of bug causing UE to crash when switching resolutions too quickly
var lastTimeResized = new Date().getTime();
var resizeTimeout;

var onDataChannelConnected;
var responseEventListeners = new Map();

var freezeFrameOverlay = null;
var shouldShowPlayOverlay = true;
// A freeze frame is a still JPEG image shown instead of the video.
var freezeFrame = {
	receiving: false,
	size: 0,
	jpeg: undefined,
	height: 0,
	width: 0,
	valid: false
};

// Optionally detect if the user is not interacting (AFK) and disconnect them.
var afk = {
	enabled: false,   // Set to true to enable the AFK system.
	warnTimeout: 120,   // The time to elapse before warning the user they are inactive.
	closeTimeout: 10,   // The time after the warning when we disconnect the user.

	active: false,   // Whether the AFK system is currently looking for inactivity.
	overlay: undefined,   // The UI overlay warning the user that they are inactive.
	warnTimer: undefined,   // The timer which waits to show the inactivity warning overlay.
	countdown: 0,   // The inactivity warning overlay has a countdown to show time until disconnect.
	countdownTimer: undefined,   // The timer used to tick the seconds shown on the inactivity warning overlay.
}

// If the user focuses on a UE4 input widget then we show them a button to open
// the on-screen keyboard. JavaScript security means we can only show the
// on-screen keyboard in response to a user interaction.
var editTextButton = undefined;

// A hidden input text box which is used only for focusing and opening the
// on-screen keyboard.
var hiddenInput = undefined;

/** Audio Streaming Parameters **/
let bufferSize = 2048,
	AudioContext=null,
	context=null,
	processor,
	input,
	globalStream;

//vars
let streamStreaming = false;



//audioStream constraints
const constraints = {
	audio: true,
	video: false
};
/** End Audio Streaming Parameters **/

function setupHtmlEvents() {
	//Window events
	window.addEventListener('resize', resizePlayerStyle, true);
	window.addEventListener('orientationchange', onOrientationChange);

	let prioritiseQualityCheckbox = document.getElementById('prioritise-quality-tgl');
	let qualityParamsSubmit = document.getElementById('quality-params-submit');

	if (prioritiseQualityCheckbox !== null) {
		prioritiseQualityCheckbox.onchange = function (event) {
			if (prioritiseQualityCheckbox.checked) {
				// TODO: This state should be read from the UE Application rather than from the initial values in the HTML
				let lowBitrate = document.getElementById('low-bitrate-text').value;
				let highBitrate = document.getElementById('high-bitrate-text').value;
				let minFPS = document.getElementById('min-fps-text').value;

				let initialDescriptor = {
					PrioritiseQuality: 1,
					LowBitrate: lowBitrate,
					HighBitrate: highBitrate,
					MinFPS: minFPS
				};
				// TODO: The descriptor should be sent as is to a generic handler on the UE side
				// but for now we're just sending it as separate console commands
				//emitUIInteraction(initialDescriptor);
				sendQualityConsoleCommands(initialDescriptor);

				qualityParamsSubmit.onclick = function (event) {
					let lowBitrate = document.getElementById('low-bitrate-text').value;
					let highBitrate = document.getElementById('high-bitrate-text').value;
					let minFPS = document.getElementById('min-fps-text').value;
					let descriptor = {
						PrioritiseQuality: 1,
						LowBitrate: lowBitrate,
						HighBitrate: highBitrate,
						MinFPS: minFPS
					};
					//emitUIInteraction(descriptor);
					sendQualityConsoleCommands(descriptor);
				};
			} else { // Prioritise Quality unchecked
				let initialDescriptor = {
					PrioritiseQuality: 0
				};
				//emitUIInteraction(initialDescriptor);
				sendQualityConsoleCommands(initialDescriptor);

				qualityParamsSubmit.onclick = null;
			}
		};
	}
}

function sendQualityConsoleCommands(descriptor) {
	if (descriptor.PrioritiseQuality !== null) {
		let command = 'Streamer.PrioritiseQuality ' + descriptor.PrioritiseQuality;
		let consoleDescriptor = {
			Console: command
		};
		emitUIInteraction(consoleDescriptor);
	}

	if (descriptor.LowBitrate !== null) {
		let command = 'Streamer.LowBitrate ' + descriptor.LowBitrate;
		let consoleDescriptor = {
			Console: command
		};
		emitUIInteraction(consoleDescriptor);
	}

	if (descriptor.HighBitrate !== null) {
		let command = 'Streamer.HighBitrate ' + descriptor.HighBitrate;
		let consoleDescriptor = {
			Console: command
		};
		emitUIInteraction(consoleDescriptor);
	}

	if (descriptor.MinFPS !== null) {
		var command = 'Streamer.MinFPS ' + descriptor.MinFPS;
		let consoleDescriptor = {
			Console: command
		};
		emitUIInteraction(consoleDescriptor);
	}
}

function setOverlay(htmlClass, htmlElement, onClickFunction, autoClick) {
	var videoPlayOverlay = document.getElementById('videoPlayOverlay');
	if (!videoPlayOverlay) {
		var playerDiv = document.getElementById('player');
		videoPlayOverlay = document.createElement('div');
		videoPlayOverlay.id = 'videoPlayOverlay';
		playerDiv.appendChild(videoPlayOverlay);
	}

	// Remove existing html child elements so we can add the new one
	while (videoPlayOverlay.lastChild) {
		videoPlayOverlay.removeChild(videoPlayOverlay.lastChild);
	}

	if (htmlElement)
		videoPlayOverlay.appendChild(htmlElement);

	if (onClickFunction && autoClick !== true) {
		videoPlayOverlay.addEventListener('click', function onOverlayClick(event) {
			onClickFunction(event);
			videoPlayOverlay.removeEventListener('click', onOverlayClick);
		});
	}

	// Remove existing html classes so we can set the new one
	var cl = videoPlayOverlay.classList;
	for (var i = cl.length - 1; i >= 0; i--) {
		cl.remove(cl[i]);
	}

	videoPlayOverlay.classList.add(htmlClass);

	if (autoClick){
		setTimeout(function () {
			onClickFunction();
		},2000);
	}
}

function showConnectOverlay() {
	var startText = document.createElement('div');
	startText.id = 'playButton';
	startText.innerHTML = '<div class="lds-ripple"><div></div><div></div></div>';

	jQuery('#chat-frame-body').hide();
	jQuery('#mic-button').hide();

	setOverlay('clickableState', startText, event => {
		connect();
		startAfkWarningTimer();
	},true);
}

function showPlayOverlay() {
	var dev = document.createElement('dev');
	dev.id = 'playButton';
	dev.innerHTML = '<div class="video-play-button"><span></span></div>'
	// dev.src = '/images/Play.png';
	// dev.alt = 'Start Streaming';

	jQuery('#chat-frame-body').hide();
	jQuery('#mic-button').hide();

	setOverlay('clickableState', dev, event => {
		if (webRtcPlayerObj)
			webRtcPlayerObj.video.play();

		requestQualityControl();

		showFreezeFrameOverlay();
		hideOverlay();
		if (cogniusConfig.text===true)
			jQuery('#chat-frame-body').show();
		jQuery('#mic-button').show();
		jQuery('#start-rec-button').click();
	});
	shouldShowPlayOverlay = false;
}

function updateAfkOverlayText() {
	afk.overlay.innerHTML = '<center>No activity detected<br>Disconnecting in ' + afk.countdown + ' seconds<br>Click to continue<br></center>';
}

function showAfkOverlay() {
	// Pause the timer while the user is looking at the inactivity warning overlay.
	stopAfkWarningTimer();

	// Show the inactivity warning overlay.
	afk.overlay = document.createElement('div');
	afk.overlay.id = 'afkOverlay';
	setOverlay('clickableState', afk.overlay, event => {
		// The user clicked so start the timer again and carry on.
		hideOverlay();
		clearInterval(afk.countdownTimer);
		startAfkWarningTimer();
	});

	afk.countdown = afk.closeTimeout;
	updateAfkOverlayText();

	if (inputOptions.controlScheme == ControlSchemeType.LockedMouse) {
		document.exitPointerLock();
	}

	afk.countdownTimer = setInterval(function () {
		afk.countdown--;
		if (afk.countdown == 0) {
			// The user failed to click so disconnect them.
			hideOverlay();
			ws.close();
		} else {
			// Update the countdown message.
			updateAfkOverlayText();
		}
	}, 1000);
}

function hideOverlay() {
	setOverlay('hiddenState');
}

// Start a timer which when elapsed will warn the user they are inactive.
function startAfkWarningTimer() {
	afk.active = afk.enabled;
	resetAfkWarningTimer();
}

// Stop the timer which when elapsed will warn the user they are inactive.
function stopAfkWarningTimer() {
	afk.active = false;
}

// If the user interacts then reset the warning timer.
function resetAfkWarningTimer() {
	if (afk.active) {
		clearTimeout(afk.warnTimer);
		afk.warnTimer = setTimeout(function () {
			showAfkOverlay();
		}, afk.warnTimeout * 1000);
	}
}

function createWebRtcOffer() {
	if (webRtcPlayerObj) {
		// showTextOverlay('Starting connection to server, please wait');
		webRtcPlayerObj.createOffer();
	} else {
		// showTextOverlay('Unable to setup video');
	}
}

function sendInputData(data) {
	if (webRtcPlayerObj) {
		resetAfkWarningTimer();
		webRtcPlayerObj.send(data);
	}
}

// Must be kept in sync with PixelStreamingProtocol::EToClientMsg C++ enum.
const ToClientMessageType = {
	QualityControlOwnership: 0,
	Response: 1,
	Command: 2,
	FreezeFrame: 3,
	UnfreezeFrame: 4
};

function setupWebRtcPlayer(htmlElement, config) {
	webRtcPlayerObj = new webRtcPlayer({ peerConnectionOptions: config.peerConnectionOptions });
	htmlElement.appendChild(webRtcPlayerObj.video);
	htmlElement.appendChild(freezeFrameOverlay);

	webRtcPlayerObj.onWebRtcOffer = function (offer) {
		if (ws && ws.readyState === WS_OPEN_STATE) {
			let offerStr = JSON.stringify(offer);
			ws.send(offerStr);
		}
	};

	webRtcPlayerObj.onWebRtcCandidate = function (candidate) {
		if (ws && ws.readyState === WS_OPEN_STATE) {
			ws.send(JSON.stringify({ type: 'iceCandidate', candidate: candidate }));
		}
	};

	webRtcPlayerObj.onVideoInitialised = function () {
		if (ws && ws.readyState === WS_OPEN_STATE) {
			if (shouldShowPlayOverlay) {
				showPlayOverlay();
				resizePlayerStyle();
			}
		}
	};

	webRtcPlayerObj.onDataChannelConnected = function () {
		if (ws && ws.readyState === WS_OPEN_STATE) {
			// showTextOverlay('WebRTC connected, waiting for video');
		}
	};

	function showFreezeFrame() {
		let base64 = btoa(freezeFrame.jpeg.reduce((data, byte) => data + String.fromCharCode(byte), ''));
		freezeFrameOverlay.src = 'data:image/jpeg;base64,' + base64;
		freezeFrameOverlay.onload = function () {
			freezeFrame.height = freezeFrameOverlay.naturalHeight;
			freezeFrame.width = freezeFrameOverlay.naturalWidth;
			resizeFreezeFrameOverlay();
			if (shouldShowPlayOverlay) {
				showPlayOverlay();
				resizePlayerStyle();
			} else {
				showFreezeFrameOverlay();
			}
		};
	}

	webRtcPlayerObj.onDataChannelMessage = function (data) {
		var view = new Uint8Array(data);
		if (freezeFrame.receiving) {
			let jpeg = new Uint8Array(freezeFrame.jpeg.length + view.length);
			jpeg.set(freezeFrame.jpeg, 0);
			jpeg.set(view, freezeFrame.jpeg.length);
			freezeFrame.jpeg = jpeg;
			if (freezeFrame.jpeg.length === freezeFrame.size) {
				freezeFrame.receiving = false;
				freezeFrame.valid = true;
				showFreezeFrame();
			} else if (freezeFrame.jpeg.length > freezeFrame.size) {
				console.error(`received bigger freeze frame than advertised: ${freezeFrame.jpeg.length}/${freezeFrame.size}`);
				freezeFrame.jpeg = undefined;
				freezeFrame.receiving = false;
			} else {
			}
		} else if (view[0] === ToClientMessageType.QualityControlOwnership) {
			let ownership = view[1] === 0 ? false : true;
			// If we own the quality control, we can't relenquish it. We only loose
			// quality control when another peer asks for it
			if (qualityControlOwnershipCheckBox !== null) {
				qualityControlOwnershipCheckBox.disabled = ownership;
				qualityControlOwnershipCheckBox.checked = ownership;
			}
		} else if (view[0] === ToClientMessageType.Response) {
			let response = new TextDecoder("utf-16").decode(data.slice(1));
			for (let listener of responseEventListeners.values()) {
				listener(response);
			}
		} else if (view[0] === ToClientMessageType.Command) {
			let commandAsString = new TextDecoder("utf-16").decode(data.slice(1));
			let command = JSON.parse(commandAsString);
			if (command.command === 'onScreenKeyboard') {
				showOnScreenKeyboard(command);
			}
		} else if (view[0] === ToClientMessageType.FreezeFrame) {
			freezeFrame.size = (new DataView(view.slice(1, 5).buffer)).getInt32(0, true);
			freezeFrame.jpeg = view.slice(1 + 4);
			if (freezeFrame.jpeg.length < freezeFrame.size) {
				freezeFrame.receiving = true;
			} else {
				showFreezeFrame();
			}
		} else if (view[0] === ToClientMessageType.UnfreezeFrame) {
			invalidateFreezeFrameOverlay();
					} else {
			console.error(`unrecognised data received, packet ID ${view[0]}`);
	}
	};

	// On a touch device we will need special ways to show the on-screen keyboard.
	if ('ontouchstart' in document.documentElement) {
		createOnScreenKeyboardHelpers(htmlElement);
	}

	createWebRtcOffer();

	return webRtcPlayerObj.video;
}

function onWebRtcAnswer(webRTCData) {
	webRtcPlayerObj.receiveAnswer(webRTCData);

	let printInterval = 5 * 60 * 1000; /*Print every 5 minutes*/
	let nextPrintDuration = printInterval;

	webRtcPlayerObj.onAggregatedStats = (aggregatedStats) => {
		let numberFormat = new Intl.NumberFormat(window.navigator.language, { maximumFractionDigits: 0 });
		let timeFormat = new Intl.NumberFormat(window.navigator.language, { maximumFractionDigits: 0, minimumIntegerDigits: 2 });
		let statsText = '';

		// Calculate duration of run
		let runTime = (aggregatedStats.timestamp - aggregatedStats.timestampStart) / 1000;
		let timeValues = [];
		let timeDurations = [60, 60];
		for (let timeIndex = 0; timeIndex < timeDurations.length; timeIndex++) {
			timeValues.push(runTime % timeDurations[timeIndex]);
			runTime = runTime / timeDurations[timeIndex];
		}
		timeValues.push(runTime);

		let runTimeSeconds = timeValues[0];
		let runTimeMinutes = Math.floor(timeValues[1]);
		let runTimeHours = Math.floor([timeValues[2]]);

		receivedBytesMeasurement = 'B';
		receivedBytes = aggregatedStats.hasOwnProperty('bytesReceived') ? aggregatedStats.bytesReceived : 0;
		let dataMeasurements = ['kB', 'MB', 'GB'];
		for (let index = 0; index < dataMeasurements.length; index++) {
			if (receivedBytes < 100 * 1000)
				break;
			receivedBytes = receivedBytes / 1000;
			receivedBytesMeasurement = dataMeasurements[index];
		}

		statsText += `Duration: ${timeFormat.format(runTimeHours)}:${timeFormat.format(runTimeMinutes)}:${timeFormat.format(runTimeSeconds)}</br>`;
		statsText += `Video Resolution: ${
			aggregatedStats.hasOwnProperty('frameWidth') && aggregatedStats.frameWidth && aggregatedStats.hasOwnProperty('frameHeight') && aggregatedStats.frameHeight ?
				aggregatedStats.frameWidth + 'x' + aggregatedStats.frameHeight : 'N/A'
			}</br>`;
		statsText += `Received (${receivedBytesMeasurement}): ${numberFormat.format(receivedBytes)}</br>`;
		statsText += `Frames Decoded: ${aggregatedStats.hasOwnProperty('framesDecoded') ? numberFormat.format(aggregatedStats.framesDecoded) : 'N/A'}</br>`;
		statsText += `Packets Lost: ${aggregatedStats.hasOwnProperty('packetsLost') ? numberFormat.format(aggregatedStats.packetsLost) : 'N/A'}</br>`;
		statsText += `Bitrate (kbps): ${aggregatedStats.hasOwnProperty('bitrate') ? numberFormat.format(aggregatedStats.bitrate) : 'N/A'}</br>`;
		statsText += `Framerate: ${aggregatedStats.hasOwnProperty('framerate') ? numberFormat.format(aggregatedStats.framerate) : 'N/A'}</br>`;
		statsText += `Frames dropped: ${aggregatedStats.hasOwnProperty('framesDropped') ? numberFormat.format(aggregatedStats.framesDropped) : 'N/A'}</br>`;
		statsText += `Latency (ms): ${aggregatedStats.hasOwnProperty('currentRoundTripTime') ? numberFormat.format(aggregatedStats.currentRoundTripTime * 1000) : 'N/A'}</br>`;

		let statsDiv = document.getElementById("stats");
		if (statsDiv) {
			statsDiv.innerHTML = statsText;
		}

		if (print_stats) {
			if (aggregatedStats.timestampStart) {
				if ((aggregatedStats.timestamp - aggregatedStats.timestampStart) > nextPrintDuration) {
					if (ws && ws.readyState === WS_OPEN_STATE) {
						ws.send(JSON.stringify({ type: 'stats', data: aggregatedStats }));
					}
					nextPrintDuration += printInterval;
				}
			}
		}
	};

	webRtcPlayerObj.aggregateStats(1 * 1000 /*Check every 1 second*/);
}

function onWebRtcIce(iceCandidate) {
	if (webRtcPlayerObj)
		webRtcPlayerObj.handleCandidateFromServer(iceCandidate);
}

var styleWidth;
var styleHeight;
var styleTop;
var styleLeft;
var styleCursor = 'default';
var styleAdditional;

const ControlSchemeType = {
	// A mouse can lock inside the WebRTC player so the user can simply move the
	// mouse to control the orientation of the camera. The user presses the
	// Escape key to unlock the mouse.
	LockedMouse: 1,

	// A mouse can hover over the WebRTC player so the user needs to click and
	// drag to control the orientation of the camera.
	HoveringMouse: 1
};

var inputOptions = {
	// The control scheme controls the behaviour of the mouse when it interacts
	// with the WebRTC player.
	controlScheme: ControlSchemeType.LockedMouse,

	// Browser keys are those which are typically used by the browser UI. We
	// usually want to suppress these to allow, for example, UE4 to show shader
	// complexity with the F5 key without the web page refreshing.
	suppressBrowserKeys: true,

	// UE4 has a faketouches option which fakes a single finger touch when the
	// user drags with their mouse. We may perform the reverse; a single finger
	// touch may be converted into a mouse drag UE4 side. This allows a
	// non-touch application to be controlled partially via a touch device.
	fakeMouseWithTouches: false
};

function resizePlayerStyleToFillWindow(playerElement) {
	let videoElement = playerElement.getElementsByTagName("VIDEO");

	// Fill the player display in window, keeping picture's aspect ratio.
	let windowAspectRatio = window.innerHeight / window.innerWidth;
	let playerAspectRatio = playerElement.clientHeight / playerElement.clientWidth;
	// We want to keep the video ratio correct for the video stream
	let videoAspectRatio = videoElement.videoHeight / videoElement.videoWidth;
	if (isNaN(videoAspectRatio)) {
		//Video is not initialised yet so set playerElement to size of window
		styleWidth = window.innerWidth;
		styleHeight = window.innerHeight;
		styleTop = 0;
		styleLeft = 0;
		playerElement.style = "top: " + styleTop + "px; left: " + styleLeft + "px; width: " + styleWidth + "px; height: " + styleHeight + "px; cursor: " + styleCursor + "; " + styleAdditional;
	} else if (windowAspectRatio < playerAspectRatio) {
		// Window height is the constraining factor so to keep aspect ratio change width appropriately
		styleWidth = Math.floor(window.innerHeight / videoAspectRatio);
		styleHeight = window.innerHeight;
		styleTop = 0;
		styleLeft = Math.floor((window.innerWidth - styleWidth) * 0.5);
		//Video is now 100% of the playerElement, so set the playerElement style
		playerElement.style = "top: " + styleTop + "px; left: " + styleLeft + "px; width: " + styleWidth + "px; height: " + styleHeight + "px; cursor: " + styleCursor + "; " + styleAdditional;
	} else {
		// Window width is the constraining factor so to keep aspect ratio change height appropriately
		styleWidth = window.innerWidth;
		styleHeight = Math.floor(window.innerWidth * videoAspectRatio);
		styleTop = Math.floor((window.innerHeight - styleHeight) * 0.5);
		styleLeft = 0;
		//Video is now 100% of the playerElement, so set the playerElement style
		playerElement.style = "top: " + styleTop + "px; left: " + styleLeft + "px; width: " + styleWidth + "px; height: " + styleHeight + "px; cursor: " + styleCursor + "; " + styleAdditional;
	}
}

function setupFreezeFrameOverlay() {
	freezeFrameOverlay = document.createElement('img');
	freezeFrameOverlay.id = 'freezeFrameOverlay';
	freezeFrameOverlay.style.display = 'none';
	freezeFrameOverlay.style.pointerEvents = 'none';
	freezeFrameOverlay.style.position = 'absolute';
	freezeFrameOverlay.style.zIndex = '30';
}

function showFreezeFrameOverlay() {
	if (freezeFrame.valid) {
		freezeFrameOverlay.style.display = 'block';
	}
}

function invalidateFreezeFrameOverlay() {
	freezeFrameOverlay.style.display = 'none';
	freezeFrame.valid = false;
}

function resizeFreezeFrameOverlay() {
	if (freezeFrame.width !== 0 && freezeFrame.height !== 0) {
		let displayWidth = 0;
		let displayHeight = 0;
		let displayTop = 0;
		let displayLeft = 0;
		let windowAspectRatio = window.innerWidth / window.innerHeight;
		let videoAspectRatio = freezeFrame.width / freezeFrame.height;

		if (windowAspectRatio < videoAspectRatio) {
			displayWidth = window.innerWidth;
			displayHeight = Math.floor(window.innerWidth / videoAspectRatio);
			displayTop = Math.floor((window.innerHeight - displayHeight) * 0.5);
			displayLeft = 0;
		} else {
			displayWidth = Math.floor(window.innerHeight * videoAspectRatio);
			displayHeight = window.innerHeight;
			displayTop = 0;
			displayLeft = Math.floor((window.innerWidth - displayWidth) * 0.5);
		}

		freezeFrameOverlay.style.width = displayWidth + 'px';
		freezeFrameOverlay.style.height = displayHeight + 'px';
		freezeFrameOverlay.style.left = displayLeft + 'px';
		freezeFrameOverlay.style.top = displayTop + 'px';
	}
}

function resizePlayerStyle(event) {
	var playerElement = document.getElementById('player');

	if (!playerElement)
		return;

	updateVideoStreamSize();

	// Calculating and normalizing positions depends on the width and height of
	// the player.
	playerElementClientRect = playerElement.getBoundingClientRect();
	setupNormalizeAndQuantize();

	if (playerElement.classList.contains('fixed-size'))
		return;

	let checkBox = document.getElementById('enlarge-display-to-fill-window-tgl');
	let windowSmallerThanPlayer = window.innerWidth < playerElement.videoWidth || window.innerHeight < playerElement.videoHeight;
	resizePlayerStyleToFillWindow(playerElement);
	resizeFreezeFrameOverlay();
}

function updateVideoStreamSize() {
	if (!matchViewportResolution) {
		return;
	}

	var now = new Date().getTime();
	if (now - lastTimeResized > 1000) {
		var playerElement = document.getElementById('player');
		if (!playerElement)
			return;

		let descriptor = {
			Console: 'setres ' + playerElement.clientWidth + 'x' + playerElement.clientHeight
		};
		emitUIInteraction(descriptor);
		lastTimeResized = new Date().getTime();
	}
	else {
		clearTimeout(resizeTimeout);
		resizeTimeout = setTimeout(updateVideoStreamSize, 1000);
	}
}

// Fix for bug in iOS where windowsize is not correct at instance or orientation change
// https://github.com/dimsemenov/PhotoSwipe/issues/1315
var _orientationChangeTimeout;
function onOrientationChange(event) {
	clearTimeout(_orientationChangeTimeout);
	_orientationChangeTimeout = setTimeout(function () {
		resizePlayerStyle();
	}, 500);
}

// Must be kept in sync with PixelStreamingProtocol::EToUE4Msg C++ enum.
const MessageType = {

	/**********************************************************************/

	/*
	 * Control Messages. Range = 0..49.
	 */
	IFrameRequest: 0,
	RequestQualityControl: 1,
	MaxFpsRequest: 2,
	AverageBitrateRequest: 3,
	StartStreaming: 4,
	StopStreaming: 5,

	/**********************************************************************/

	/*
	 * Input Messages. Range = 50..89.
	 */

	// Generic Input Messages. Range = 50..59.
	UIInteraction: 50,
	Command: 51,

	// Keyboard Input Message. Range = 60..69.
	KeyDown: 60,
	KeyUp: 61,
	KeyPress: 62,

	// Mouse Input Messages. Range = 70..79.
	MouseEnter: 70,
	MouseLeave: 71,
	MouseDown: 72,
	MouseUp: 73,
	MouseMove: 74,
	MouseWheel: 75,

	// Touch Input Messages. Range = 80..89.
	TouchStart: 80,
	TouchEnd: 81,
	TouchMove: 82

	/**************************************************************************/
};

// A generic message has a type and a descriptor.
function emitDescriptor(messageType, descriptor) {
	// Convert the dscriptor object into a JSON string.
	let descriptorAsString = JSON.stringify(descriptor);

	// Add the UTF-16 JSON string to the array byte buffer, going two bytes at
	// a time.
	let data = new DataView(new ArrayBuffer(1 + 2 + 2 * descriptorAsString.length));
	let byteIdx = 0;
	data.setUint8(byteIdx, messageType);
	byteIdx++;
	data.setUint16(byteIdx, descriptorAsString.length, true);
	byteIdx += 2;
	for (i = 0; i < descriptorAsString.length; i++) {
		data.setUint16(byteIdx, descriptorAsString.charCodeAt(i), true);
		byteIdx += 2;
	}
	// sendInputData(data.buffer);
}

// A UI interation will occur when the user presses a button powered by
// JavaScript as opposed to pressing a button which is part of the pixel
// streamed UI from the UE4 client.
function emitUIInteraction(descriptor) {
	emitDescriptor(MessageType.UIInteraction, descriptor);
}

function requestQualityControl() {
	sendInputData(new Uint8Array([MessageType.RequestQualityControl]).buffer);
}

var playerElementClientRect = undefined;
var normalizeAndQuantizeUnsigned = undefined;
var normalizeAndQuantizeSigned = undefined;

function setupNormalizeAndQuantize() {
	let playerElement = document.getElementById('player');
	let videoElement = playerElement.getElementsByTagName("video");

	if (playerElement && videoElement.length > 0) {
		let playerAspectRatio = playerElement.clientHeight / playerElement.clientWidth;
		let videoAspectRatio = videoElement[0].videoHeight / videoElement[0].videoWidth;

		// Unsigned XY positions are the ratio (0.0..1.0) along a viewport axis,
		// quantized into an uint16 (0..65536).
		// Signed XY deltas are the ratio (-1.0..1.0) along a viewport axis,
		// quantized into an int16 (-32767..32767).
		// This allows the browser viewport and client viewport to have a different
		// size.
		// Hack: Currently we set an out-of-range position to an extreme (65535)
		// as we can't yet accurately detect mouse enter and leave events
		// precisely inside a video with an aspect ratio which causes mattes.
		if (playerAspectRatio > videoAspectRatio) {
			if (print_inputs) {
			}
			let ratio = playerAspectRatio / videoAspectRatio;
			// Unsigned.
			normalizeAndQuantizeUnsigned = (x, y) => {
				let normalizedX = x / playerElement.clientWidth;
				let normalizedY = ratio * (y / playerElement.clientHeight - 0.5) + 0.5;
				if (normalizedX < 0.0 || normalizedX > 1.0 || normalizedY < 0.0 || normalizedY > 1.0) {
					return {
						inRange: false,
						x: 65535,
						y: 65535
					};
				} else {
					return {
						inRange: true,
						x: normalizedX * 65536,
						y: normalizedY * 65536
					};
				}
			};
			unquantizeAndDenormalizeUnsigned = (x, y) => {
				let normalizedX = x / 65536;
				let normalizedY = (y / 65536 - 0.5) / ratio + 0.5;
				return {
					x: normalizedX * playerElement.clientWidth,
					y: normalizedY * playerElement.clientHeight
				};
			};
			// Signed.
			normalizeAndQuantizeSigned = (x, y) => {
				let normalizedX = x / (0.5 * playerElement.clientWidth);
				let normalizedY = (ratio * y) / (0.5 * playerElement.clientHeight);
				return {
					x: normalizedX * 32767,
					y: normalizedY * 32767
				};
			};
		} else {
			if (print_inputs) {
			}
			let ratio = videoAspectRatio / playerAspectRatio;
			// Unsigned.
			normalizeAndQuantizeUnsigned = (x, y) => {
				let normalizedX = ratio * (x / playerElement.clientWidth - 0.5) + 0.5;
				let normalizedY = y / playerElement.clientHeight;
				if (normalizedX < 0.0 || normalizedX > 1.0 || normalizedY < 0.0 || normalizedY > 1.0) {
					return {
						inRange: false,
						x: 65535,
						y: 65535
					};
				} else {
					return {
						inRange: true,
						x: normalizedX * 65536,
						y: normalizedY * 65536
					};
				}
			};
			unquantizeAndDenormalizeUnsigned = (x, y) => {
				let normalizedX = (x / 65536 - 0.5) / ratio + 0.5;
				let normalizedY = y / 65536;
				return {
					x: normalizedX * playerElement.clientWidth,
					y: normalizedY * playerElement.clientHeight
				};
			};
			// Signed.
			normalizeAndQuantizeSigned = (x, y) => {
				let normalizedX = (ratio * x) / (0.5 * playerElement.clientWidth);
				let normalizedY = y / (0.5 * playerElement.clientHeight);
				return {
					x: normalizedX * 32767,
					y: normalizedY * 32767
				};
			};
		}
	}
}

function createOnScreenKeyboardHelpers(htmlElement) {
	if (document.getElementById('hiddenInput') === null) {
		hiddenInput = document.createElement('input');
		hiddenInput.id = 'hiddenInput';
		hiddenInput.maxLength = 0;
		htmlElement.appendChild(hiddenInput);
	}

	if (document.getElementById('editTextButton') === null) {
		editTextButton = document.createElement('button');
		editTextButton.id = 'editTextButton';
		editTextButton.innerHTML = 'edit text';
		htmlElement.appendChild(editTextButton);

		// Hide the 'edit text' button.
		editTextButton.classList.add('hiddenState');

		editTextButton.addEventListener('click', function () {
			// Show the on-screen keyboard.
			hiddenInput.focus();
		});
	}
}

function showOnScreenKeyboard(command) {
	if (command.showOnScreenKeyboard) {
		// Show the 'edit text' button.
		editTextButton.classList.remove('hiddenState');
		// Place the 'edit text' button near the UE4 input widget.
		let pos = unquantizeAndDenormalizeUnsigned(command.x, command.y);
		editTextButton.style.top = pos.y.toString() + 'px';
		editTextButton.style.left = (pos.x - 40).toString() + 'px';
	} else {
		// Hide the 'edit text' button.
		editTextButton.classList.add('hiddenState');
		// Hide the on-screen keyboard.
		hiddenInput.blur();
	}
}

function avatarStart() {
	let statsDiv = document.getElementById("stats");
	if (statsDiv) {
		statsDiv.innerHTML = 'Not connected';
	}

	if (!connect_on_load || is_reconnection) {
		showConnectOverlay();
		invalidateFreezeFrameOverlay();
		shouldShowPlayOverlay = true;
		resizePlayerStyle();
	} else {
		connect();
	}
}

function connect() {
	"use strict";

	window.WebSocket = window.WebSocket || window.MozWebSocket;

	if (!window.WebSocket) {
		alert('Your browser doesn\'t support WebSocket');
		return;
	}

	ws = new WebSocket(cogniusConfig.graphicApi);

	ws.onmessage = function (event) {
		var msg = JSON.parse(event.data);
		if (msg.type === 'config') {
			onConfig(msg);
		} else if (msg.type === 'playerCount') {
			// updateKickButton(msg.count - 1);
		} else if (msg.type === 'answer') {
			onWebRtcAnswer(msg);
		} else if (msg.type === 'iceCandidate') {
			onWebRtcIce(msg.candidate);
		} else {
		}
	};

	ws.onerror = function (event) {
		console.log(`WS error: ${JSON.stringify(event)}`);
	};

	ws.onclose = function (event) {
		console.log(`WS closed: ${JSON.stringify(event.code)} - ${event.reason}`);
		ws = undefined;
		is_reconnection = true;

		// destroy `webRtcPlayerObj` if any
		let playerDiv = document.getElementById('player');
		if (webRtcPlayerObj) {
			playerDiv.removeChild(webRtcPlayerObj.video);
			webRtcPlayerObj.close();
			webRtcPlayerObj = undefined;
		}

		avatarStart();
	};
}

// Config data received from WebRTC sender via the Cirrus web server
function onConfig(config) {
	let playerDiv = document.getElementById('player');
	let playerElement = setupWebRtcPlayer(playerDiv, config);
	resizePlayerStyle();

	switch (inputOptions.controlScheme) {
		case ControlSchemeType.HoveringMouse:
			// registerHoveringMouseEvents(playerElement);
			break;
		case ControlSchemeType.LockedMouse:
			// registerLockedMouseEvents(playerElement);
			break;
		default:
			console.log(`ERROR: Unknown control scheme ${inputOptions.controlScheme}`);
			// registerLockedMouseEvents(playerElement);
			break;
	}
}

/** Voice recording section **/

window.onbeforeunload = function () {
	if (streamStreaming) { socket.emit('endVoiceStream', ''); }
};

function initRecording() {

	socket.emit('startVoiceStream', ''); //init socket Google Speech Connection
	streamStreaming = true;

	if (AudioContext === null)
	{
		AudioContext = window.AudioContext || window.webkitAudioContext;
		context = new AudioContext({
			// if Non-interactive, use 'playback' or 'balanced' // https://developer.mozilla.org/en-US/docs/Web/API/AudioContextLatencyCategory
			latencyHint: 'interactive',
		});
		processor = context.createScriptProcessor(bufferSize, 1, 1);
		processor.connect(context.destination);
		context.resume();

		var handleSuccess = function (stream) {
			globalStream = stream;
			input = context.createMediaStreamSource(stream);
			input.connect(processor);

			processor.onaudioprocess = function (e) {
				microphoneProcess(e);
			};
		};
		if (navigator.mediaDevices === undefined) {
			navigator.mediaDevices = {};
		  }

		//   if (navigator.mediaDevices.getUserMedia === undefined) {
		// 	navigator.mediaDevices.getUserMedia = function(constraints) {
		// 	  // First get ahold of the legacy getUserMedia, if present
		// 	  let getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

		// 	  // Some browsers just don't implement it - return a rejected promise with an error
		// 	  // to keep a consistent interface
		// 	  if (!getUserMedia) {
		// 		return Promise.reject(new Error('getUserMedia is not implemented in this browser'));
		// 	  }

		// 	  // Otherwise, wrap the call to the old navigator.getUserMedia with a Promise
		// 	  return new Promise(function(resolve, reject) {
		// 		getUserMedia.call(navigator, constraints, resolve, reject);
		// 	  });
		// 	}
		//   }
		  navigator.mediaDevices.getUserMedia({
			audio: true
		  }).then(handleSuccess).catch((e)=>{alert(e)});
		// navigator.mediaDevices.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
		// navigator.mediaDevices.getUserMedia(constraints)
		// 	.then(handleSuccess).catch((e)=>{alert(e)});


	}
	else
		context.resume();
}

function microphoneProcess(e) {
	var left = e.inputBuffer.getChannelData(0);
	// var left16 = convertFloat32ToInt16(left); // old 32 to 16 function
	var left16 = downsampleBuffer(left, 44100, 16000);

	if (isVoiceListen)
		socket.emit('binaryData', left16);
}

var recordingStatus = document.getElementById("recordingStatus");
var isVoiceListen = false;
var restartTimer = null;
var listenAnimationAllowed = true;
var textGenerationOnSpeechQueue = [];
var speechDataQueue = [];
var endOfConversation = false;

function startRecording() {
	isVoiceListen = true;
	// jQuery("#mic-active-mute-button").prop('checked',true)
	initRecording();
	setTimeout(function () {
		listeningAnimation(true);
	},100);
}

function stopRecording(withAudioRunning) {
	if (withAudioRunning !== true)
		stopAudio();
	socket.emit('endVoiceStream', '');

	context.suspend();
	// waited for FinalWord
	isVoiceListen = false;
	streamStreaming = false;

	if (globalStream && false)
	{
		// waited for FinalWord
		isVoiceListen = false;
		streamStreaming = false;

		let track = globalStream.getTracks()[0];
		track.stop();

		if (input !== null)
		{
			input.disconnect(processor);
			processor.disconnect(context.destination);
			context.close().then(function () {
				input = null;
				processor = null;
				context = null;
				AudioContext = null;
			});
		}
	}
	listeningAnimation(false);
}

function listeningAnimation(animationControl) {
	if (animationControl === true && document.getElementById('cog-listening-animation') === null && listenAnimationAllowed)
	{
		let animationDiv = document.createElement('div');
		animationDiv.id = 'cog-listening-animation';
		animationDiv.classList.add('mine');
		animationDiv.classList.add('messages');
		animationDiv.innerHTML = '<div style="width: 70px;height:35px;" class="message last">' +
			'	<div id="cog-listening-animation">' +
			'	<span></span><span></span><span></span><span></span><span></span>' +
			'	</div>' +
			'</div>';
		document.getElementById('chat-history-frame').appendChild(animationDiv);
		jQuery('#chat-history-frame').animate({scrollTop: jQuery('#chat-history-frame').prop('scrollHeight')}, 100);
	}
	else{
		if (document.getElementById('cog-listening-animation') !== null)
			document.getElementById('cog-listening-animation').remove();
	}

}

function downsampleBuffer(buffer, sampleRate, outSampleRate) {
	if (outSampleRate == sampleRate) {
		return buffer;
	}
	if (outSampleRate > sampleRate) {
		throw "downsampling rate show be smaller than original sample rate";
	}
	var sampleRateRatio = sampleRate / outSampleRate;
	var newLength = Math.round(buffer.length / sampleRateRatio);
	var result = new Int16Array(newLength);
	var offsetResult = 0;
	var offsetBuffer = 0;
	while (offsetResult < result.length) {
		var nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
		var accum = 0, count = 0;
		for (var i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
			accum += buffer[i];
			count++;
		}

		result[offsetResult] = Math.min(1, accum / count) * 0x7FFF;
		offsetResult++;
		offsetBuffer = nextOffsetBuffer;
	}
	return result.buffer;
}

/** Voice recording section ends **/

/** AI communication section **/

function sendLipSyncData(lipSyncText,lipSyncFileName) {

	let i,data;

	// send lypsync text
	for(i=0;i<lipSyncText.length;i++)
	{
		data = new DataView(new ArrayBuffer(3));
		data.setUint8(0, MessageType.KeyPress);
		data.setUint16(1, lipSyncText.charCodeAt(i), true);
		sendInputData(data.buffer);
	}

	// send enter
	sendInputData(new Uint8Array([MessageType.KeyDown, 13, false]).buffer);

	setTimeout(function () { // This delay is needed for the animation engine to avoid race conditions
		// send filename
		for(i=0;i<lipSyncFileName.length;i++)
		{
			data = new DataView(new ArrayBuffer(3));
			data.setUint8(0, MessageType.KeyPress);
			data.setUint16(1, lipSyncFileName.charCodeAt(i), true);
			sendInputData(data.buffer);
		}
	},100)


	setTimeout(function () {
		// send enter
		sendInputData(new Uint8Array([MessageType.KeyDown, 13, false]).buffer);
	},100);

}

function messageSend(){
	let message = jQuery('#chat-input').val();
	if (message.trim() !== '')
	{
		generateChatHistory([message],'MINE');
		// jQuery('#chat-history-frame').animate({scrollTop: jQuery('#chat-history-frame').prop('scrollHeight')}, 100);
		socket.emit('textData',{outputMode: cogniusConfig.audio? 'VOICE': 'TEXT',text: message});
	}
	jQuery('#chat-input').val('');
	listeningAnimation(false);
}

let source = null;
function generateAudio(data,isFirst,isFinal,endCallback) {
	if(jQuery("#mic-active-mute-button").is(':checked') || endOfConversation === true){
		let audioCtx = new (window.AudioContext || window.webkitAudioContext)();
		audioCtx.decodeAudioData(data,function (voiceBuffer) {
			source = audioCtx.createBufferSource();
			source.buffer = voiceBuffer;
			source.onended = function () {
				if (endCallback)
					endCallback();

				if(jQuery("#mic-active-mute-button").is(':checked') && isFinal===true)
				{
					startRecording();
					playAlertSound();
				}

				source = null;

			};
			source.connect(audioCtx.destination);

			// if(isFirst===true)
				stopRecording();
			source.start();
		});
	}
	else
	{
		if (endCallback)
			endCallback();
	}
}

function stopAudio(){
	if (source && source !== null)
	{
		try{
			source.stop();
		}
		catch (e) {

		}

	}
}

function generateChatHistory(messages,mode,endCallback){

	if(source !== null){
		source.stop();
	}

	messages.forEach(function (message,index) {
		let messageTemplate = '<div class="{modeClass} messages">\n' +
			'    <div class="message last">' +
			'      {message}\n' +
			'    </div>'+
			'  </div>';

		if (mode=== 'YOURS'){
			messageTemplate = messageTemplate.replace('{modeClass}','yours');
		}
		else{
			messageTemplate = messageTemplate.replace('{modeClass}','mine')
		}
		messageTemplate = messageTemplate.replace('{message}',message);
		if(mode === 'YOURS'){
			let wrapperElement = '' +
				'<div class="row">' +
				'<div class="col-2 mt-auto mb-3">\n' +
				'   <img src="'+cogniusConfig.brandImage+'" class="img-fluid">\n' +
				'</div>\n' +
				'<div class="col-10 pl-0">\n'+
					messageTemplate +
				'</div>' +
				'</div>';

			if (jQuery("#mic-active-mute-button").is(':checked'))
            {
				textGenerationOnSpeechQueue.push(function () {
					jQuery('#chat-history-frame').append(wrapperElement);
					jQuery('#chat-history-frame').animate({scrollTop: jQuery('#chat-history-frame').prop('scrollHeight')-100}, 2000);

				})
				if (index === messages.length - 1 && endCallback){
					textGenerationOnSpeechQueue.push(function () {
						endCallback();
						jQuery('#chat-history-frame').animate({scrollTop: jQuery('#chat-history-frame').prop('scrollHeight')-100}, 2000);
					});
				}
            }
			else
            {
                jQuery('#chat-history-frame').append(wrapperElement);
				jQuery('#chat-history-frame').animate({scrollTop: jQuery('#chat-history-frame').prop('scrollHeight')}, 1000);
                if (index === messages.length - 1 && endCallback){
                    endCallback();
					jQuery('#chat-history-frame').animate({scrollTop: jQuery('#chat-history-frame').prop('scrollHeight')}, 1000);
                }
            }
		}
		else
		{

			jQuery('#chat-history-frame').append(messageTemplate);
			if (endCallback){
				endCallback();
			}

			jQuery('#chat-history-frame').animate({scrollTop: jQuery('#chat-history-frame').prop('scrollHeight')}, 2000);
		}


	})
}

function generateChatGraphicElements(graphicsElements) {
	let chatHistory = document.getElementById('chat-history-frame');

	graphicsElements.forEach(function (element) {

		// Multiple select options presented via buttons
		if (element.type === 'select'){
			let allChildNodes = [];
			element.options.forEach(function (option) {
				let node = document.createElement('div');
				node.classList.add('chat-options');
				let childNode = document.createElement('button');
				childNode.innerHTML = option;
				childNode.onclick = function () {
					document.getElementById('chat-input').value = option;
					messageSend();

					// after selecting one of the options, all of the options should be disabled
					allChildNodes.forEach(function (clickableChildNode) {
						clickableChildNode.onclick = function () {
							return false;
						}
					})
				}
				allChildNodes.push(childNode);
				node.append(childNode);
				chatHistory.append(node);
			})

		}

		if (element.type === 'link'){
			let node = document.createElement('div');
			node.classList.add('yours');
			node.classList.add('messages');
			node.innerHTML = '<div class="message last">' +
				'	<div class="chat-link"><a href="'+element.href+'"  target="_blank">'+element.text+'</a></div>' +
				'</div>';
			chatHistory.append(node);

		}

		if (element.type === 'image'){
			let node = document.createElement('div');
		}

	});
}

/** AI communication section ends**/

/** UI generation**/

function alertOverlay(text,onClick) {
	let otherOverlayElements = document.getElementsByClassName('cog-overlay');
	let i;
	for(i=0;i<otherOverlayElements.length;i++){
		otherOverlayElements[i].remove();
	}

	let overlay = document.createElement('div');
	let actionButton = document.createElement('button');
	overlay.classList.add('cog-overlay');
	overlay.innerHTML = '<img src="'+cogniusConfig.brandImageFront+'" class="cog-overlay-brand-image"/><div class="cog-overlay-text-div">' +
		'<text class="cog-overlay-text-upper-header">'+cogniusConfig.preConfigText.overlayUpperHeader+'</text>' +
		'<text class="cog-overlay-text-header">'+cogniusConfig.preConfigText.overlayHeader+'</text>' +
		'<text class="cog-overlay-text-desc">'+cogniusConfig.preConfigText.overlayDescription+'</text></div>';

	actionButton.innerHTML = text;
	actionButton.onclick = function () {
		if (typeof onClick === 'function')
			onClick();
		overlay.remove();
	};

	overlay.appendChild(actionButton);

	document.getElementById('chat-frame-body').appendChild(overlay);
}

function playAlertSound() {
	document.getElementById('listen-alert-sound').play();
}

function generateUI(){

	const bodyInternals = '' +
		'<div id="chat-frame" style="">\n' +
		'        <div id="chat-title-frame" class="row">\n' +
		'            <div class="col-5">\n' +
		'                <label id="chat-header-text">Hi There</label>\n' +
		'            </div>\n' +
		'            <div id="chat-frame-controllers" class="col-7">\n' +
		'                <dev id="chat-frame-minimize-button" class="chat-frame-minimize-button-up"></dev>\n' +
		'            </div>\n' +
		'        </div>' +
		'	<div id="chat-frame-body" style="display: none;">' +
		'        <div id="chat-history-frame">\n' +
		'            <div class="chat-options"></div>\n' +
		'        </div>\n' +
		'        <div id="chat-area-frame" class="row" >\n' +
		'            <div id="chat-input-frame" style="padding-right: 0" >\n' +
		'                <input id="chat-input">\n' +
		'            <div id="chat-button-frame" >\n' +
		'                <div id="mic-button" class="mic-active-mute-mini" style="">\n' +
		'                    <input type="checkbox" value="None" id="mic-active-mute-button" name="check">\n' +
		'                    <label id="start-rec-button" for="mic-active-mute-button"></label>\n' +
		'                </div>\n' +
		'            </div>\n' +
		'            </div>\n' +

		'        </div>' +
		'	</div>' +
		'</div>' +
		'<audio id="listen-alert-sound" src="assets/sounds/listen.mp3" preload="auto"></audio>';


	const scriptImports = [
		'assets/jquery/jquery.min.js',
		'assets/adaptor/adapter-latest.js' ,
		'assets/compromise/compromise.min.js' ,
		'assets/socket.io/socket.io.js' ,
		'assets/socket.io/socket.io-stream.js' ,
		'assets/web-rtc-player.js' ,
		// 'assets/speech-stream.js'
		]

	const styleImports = [
		'assets/bootstrap/bootstrap.min.css' ,
		'assets/avatar-player.css',
		'assets/styles.css'
	]

	scriptImports.forEach(function (scriptLink) {
		var scriptImport = document.createElement('script');
		scriptImport.type="text/javascript";
		scriptImport.src=scriptLink;
		document.head.appendChild(scriptImport);
	});

	styleImports.forEach(function (styleLink) {
		var linkImport = document.createElement('link');
		linkImport.type="text/css";
		linkImport.rel="stylesheet";
		linkImport.href=styleLink;
		document.head.appendChild(linkImport);
	});

	if (typeof document.body !== 'undefined')
	{
		if (cogniusConfig.avatar)
		{
			document.body.innerHTML = bodyInternals;
		}
		else {
			let chatboxWrapper = document.createElement('div');
			chatboxWrapper.innerHTML = bodyInternals;
			document.body.appendChild(chatboxWrapper);
		}

		document.head.append(scriptImports);
		window.onload = function(){
			domEventsRegister();
		}
	}
}

function domEventsRegister(){

	var restartTimer = null;

	socket = io.connect(cogniusConfig.aiApi,{
		'reconnection': true,
		'reconnectionDelay': 1000,
		'reconnectionDelayMax' : 5000,
		'reconnectionAttempts': 3
	});

	socket.emit('join',{botId:cogniusConfig.botId,sessionId:cogniusConfig.sessionId});

	socket.on('textData', function (dataJson) {
		textGenerationOnSpeechQueue = [];
		speechDataQueue = [];
		if (typeof dataJson.inputText !== "undefined")
			generateChatHistory([dataJson.inputText],'MINE');

		console.log(dataJson);
		listeningAnimation(false);

		listenAnimationAllowed = true;
		if (Array.isArray(dataJson.commands))
		{
			dataJson.commands.forEach((function (selectedCommand) {
				if(selectedCommand.command === 'INPUT_TEXT_ONLY')
					listenAnimationAllowed = false
			}))
		}

		generateChatHistory(dataJson.text,'YOURS',function () {
            generateChatGraphicElements(dataJson.graphicElements);
        });

		// sendLipSyncData(dataJson.voiceScript,dataJson.lipSyncToken+'.WAV');

	});

	socket.on('pauseRec',function () {

		if (restartTimer !== null){
			console.log("Timer started");
			clearInterval(restartTimer);
			restartTimer = null;
		}
	});

	socket.on('startRec',function () {

		console.log("Timer started");
		// In backend, the stt timeout happens every minute

		if (restartTimer === null)
		{
			restartTimer = setInterval(function () {
				socket.emit('endVoiceStream','');
				socket.emit('startVoiceStream','');
				console.log('Refresh timer called');
			},30000);
		}

	});

	socket.on('binaryData',function (data) {
		console.log('---------- data length -----------------');
		console.log(data.byteLength);
		speechDataQueue.push(data);

		// console.log(data.byteLength);
		// console.log(data['Int16Array']);
	});

	socket.on('voiceStartFlag',function (data) {
		speechDataQueue.forEach(function (index,speechData) {
			// if ()
		});
		// var speechData = speechDataQueue.shift(),
		var recursiveGeneration = function(isFirst) {
			if (speechDataQueue.length > 0) {
				let isFinal = false;
				let textGeneration = textGenerationOnSpeechQueue.shift();

				if (textGeneration)
					textGeneration();

				if (speechDataQueue.length === 1)
				{
					isFinal = true;
					while (textGenerationOnSpeechQueue.length){
						textGeneration = textGenerationOnSpeechQueue.shift();
						if (textGeneration)
							textGeneration();
					}
				}

				generateAudio(speechDataQueue.shift(), isFirst, isFinal, function () {
					recursiveGeneration(false);
				});
				// if(cogniusConfig.avatar)
					// sendLipSyncData(dataJson.voiceScript,dataJson.lipSyncToken+'.WAV');
			}
		}

		recursiveGeneration();
		// console.log(data.byteLength);
		// console.log(data['Int16Array']);
	});

	socket.on('disconnect',function (data) {
		endOfConversation=true;
		if(jQuery("#mic-active-mute-button").is(':checked'))
		{
			jQuery("#mic-active-mute-button").click();

		}
		stopRecording(true);
		jQuery("#mic-active-mute-button").prop("disabled","disabled");
		jQuery('#chat-input').prop("disabled","disabled");
		setTimeout(function(){
			alertOverlay('Click to Reconnect',function () {
				window.location.reload();
			});
		},100000);

	});

	jQuery("#start-rec-button").click(function () {
		if (!jQuery("#mic-active-mute-button").is(':checked')){
			startRecording();
			playAlertSound();
		}
		else{
			stopRecording();
		}
	});

	jQuery('#chat-frame-minimize-button').click(function () {
		if(jQuery(this).hasClass('chat-frame-minimize-button-down'))
		{
			jQuery(this).removeClass('chat-frame-minimize-button-down');
			jQuery(this).addClass('chat-frame-minimize-button-up');
			jQuery('#chat-frame-body').hide();
		}
		else
		{
			jQuery(this).removeClass('chat-frame-minimize-button-up');
			jQuery(this).addClass('chat-frame-minimize-button-down');
			jQuery('#chat-frame-body').show();
		}


	});

	jQuery('#chat-input').keydown(function (e) {
		let key = e.which;
		if(key === 13)  // the enter key code
		{
			messageSend();
		}
	});

	if (!cogniusConfig.avatar && cogniusConfig.audio && cogniusConfig.micOnStart)
	{
		alertOverlay('Engage Me',function () {
			jQuery('#start-rec-button').click();
			socket.emit('textData',{outputMode: cogniusConfig.audio? 'VOICE': 'TEXT',text: '',greeting: true});
		});
	}

	setupHtmlEvents();

	// setupFreezeFrameOverlay();
	// avatarStart();
	if (cogniusConfig.avatar)
	{
		setupFreezeFrameOverlay();
		avatarStart();
	}

	if (!cogniusConfig.avatar)
	{
		jQuery('#playerUI').hide();
		jQuery('#chat-frame-body').show();
		if (cogniusConfig.audio)
		{
			jQuery('#mic-button').show();
		}
	}

	if(cogniusConfig.chatOpenOnStart)
		setTimeout(function () {
			jQuery('#chat-frame-minimize-button').click();
		},1000);

	// Presenting initial text.
	// setTimeout(function () {
	// 	if (cogniusConfig.initialText && cogniusConfig.initialText.length)
	// 		generateChatHistory(cogniusConfig.initialText,'YOURS');
	// },2000);

}
/** UI generation section ends**/

generateUI();
