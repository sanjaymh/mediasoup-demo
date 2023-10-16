const childProcess = require('child_process');

const generateRtpStream = async (router) => 
{
	const videoTransport = await router.createPlainTransport(
		{ 
			listenIp : '127.0.0.1',
			rtcpMux  : false,
			comedia  : true
		});
      
	// Read the transport local RTP port.
	const videoRtpPort = videoTransport.tuple.localPort;
      
	// Read the transport local RTCP port.
	const videoRtcpPort = videoTransport.rtcpTuple.localPort;

	console.log(`videoRtpPort: ${videoRtpPort}, videoRtcpPort: ${videoRtcpPort}`);

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

	cp.stdout.on('data', (data) => 
	{
		console.log(`stdout: ${data}`);
	});

	cp.stderr.on('data', (data) => 
	{
		console.log(`stderr: ${data}`);
	});

	cp.on('error', (error) => 
	{
		console.log(`error: ${error.message}`);
	});

	cp.on('close', (code) => 
	{
		console.log(`child process exited with code ${code}`);
	});
	
	return videoProducer;

};

module.exports = generateRtpStream;