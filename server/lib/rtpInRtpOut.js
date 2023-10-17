const childProcess = require('child_process');

/** comand to run ffmpeg on comand line */
// ffmpeg -re -v info -stream_loop -1 -i D:/Projects/my_projects/mediasoup_examples/mediasoup-demo/server/recs/rec_3.mp4 -map 0:v:0 -pix_fmt yuv420p -c:v libx264 -b:v 1000k -deadline realtime -cpu-used 4 -f tee "[select=v:f=rtp:ssrc=22222222:payload_type=102]rtp://127.0.0.1:43230?rtcpport=49107"

let videoTransport;
let videoRtpPort;
let videoRtcpPort;

let remoteIp;
let remotePort;
let remoteRtcpPort;

const initiateGetStats = async (interval) => 
{
	setInterval(async () => 
	{
		const stats = await videoTransport.getStats();

		console.log('stats of PLAIN video transport ***************', stats);
	}, interval);
};

const plainTransportOptions = {
	listenIp   : '127.0.0.1',
	rtcpMux    : false,
	comedia    : true,
	// enableSrtp : false
};

const createVideoTransport = async (router) => 
{
	if (plainTransportOptions.enableSrtp) // Only required if SRTP.
	{
		plainTransportOptions.srtpParameters =
        {
        	cryptoSuite : 'AES_CM_128_HMAC_SHA1_80',
        	keyBase64   : 'ZnQ3eWJraDg0d3ZoYzM5cXN1Y2pnaHU5NWxrZTVv'
        };
	}
	videoTransport = await router.createPlainTransport(plainTransportOptions);
	console.log('stats of PLAIN video transport tuples (ip and ports) ***************', videoTransport.tuple, videoTransport.rtcpTuple);
	// Read the transport local RTP port.
	videoRtpPort = videoTransport.tuple.localPort;  
	// Read the transport local RTCP port.
	videoRtcpPort = videoTransport.rtcpTuple?.localPort ? videoTransport.rtcpTuple.localPort : videoRtpPort;

	remoteIp = videoTransport.tuple?.remoteIp;
	remotePort = videoTransport.tuple?.remotePort;
	remoteRtcpPort = videoTransport.rtcpTuple?.remotePort;

	console.log(
		`videoRtpPort: ${videoRtpPort},
         videoRtcpPort: ${videoRtcpPort},
         remoteIp: ${remoteIp},
         remoteRtpPort: ${remotePort}
         remoteRtcpPort: ${remoteRtcpPort}`
	);

	initiateGetStats(5000);
	
	return { videoTransport, videoRtpPort, videoRtcpPort };
};

const produceRtpStream = async () => 
{   
	const transportConnectionOption = {
		ip       : '127.0.0.1',
		port     : remotePort ? remotePort : videoRtpPort,
		rtcpPort : remoteRtcpPort ? remoteRtcpPort : videoRtcpPort
	};

	if (plainTransportOptions.enableSrtp) 
	{
		transportConnectionOption.srtpParameters =
        {
        	cryptoSuite : 'AES_CM_128_HMAC_SHA1_80',
        	keyBase64   : 'ZnQ3eWJraDg0d3ZoYzM5cXN1Y2pnaHU5NWxrZTVv'
        };
	}
	// await videoTransport.connect(transportConnectionOption);
	const videoProducer = await videoTransport.produce(
		{
			kind          : 'video',
			rtpParameters :
          {
          	codecs :
            [
            	{
            		mimeType     : 'video/h264',
            		clockRate    : 90000,
            		payloadType  : 102,
            		rtcpFeedback : [ ], // FFmpeg does not support NACK nor PLI/FIR.
            		parameters   :
					{
						'packetization-mode'      : 1,
						'profile-level-id'        : '42e01f',
						'level-asymmetry-allowed' : 1,
						'x-google-start-bitrate'  : 1000
					}
            	}
            ],
          	encodings : [ { ssrc: 22222222 } ]
          }
		});

	/** run ffmpeg in a child process */
	const cp = childProcess.spawn(
		'ffmpeg',
		[
			'-re',
			'-v', 'info',
			'-stream_loop', '-1',
			'-i', 'D:/Projects/my_projects/mediasoup_examples/mediasoup-demo/server/recs/rec_3.mp4',
			'-map', '0:v:0',
			'-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-b:v', '1000k', '-deadline', 'realtime', '-cpu-used', '4',
			'-f', 'tee',
			`[select=v:f=rtp:ssrc=22222222:payload_type=102]rtp://127.0.0.1:${videoRtpPort}?rtcpport=${videoRtcpPort}`
		]
	);

	// cp.stdout.on('data', (data) => 
	// {
	// 	console.log(`stdout: ${data}`);
	// });
	// cp.stderr.on('data', (data) => 
	// {
	// 	console.log(`stderr: ${data}`);
	// });
	// cp.on('error', (error) => 
	// {
	// 	console.log(`error: ${error.message}`);
	// });
	// cp.on('close', (code) => 
	// {
	// 	console.log(`child process exited with code ${code}`);
	// });
	
	return videoProducer;

};

module.exports = { produceRtpStream, createVideoTransport };