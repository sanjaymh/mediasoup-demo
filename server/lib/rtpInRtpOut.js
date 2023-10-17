const childProcess = require('child_process');

// ffmpeg -re -v info -stream_loop -1 -i D:/Projects/my_projects/mediasoup_examples/mediasoup-demo/server/recs/rec_3.mp4 -map 0:v:0 -pix_fmt yuv420p -c:v libx264 -b:v 1000k -deadline realtime -cpu-used 4 -f tee "[select=v:f=rtp:ssrc=22222222:payload_type=102]rtp://127.0.0.1:43230?rtcpport=49107"

let videoTransport;
let videoRtpPort;
let videoRtcpPort;

const initiateGetStats = async (interval) => 
{
	setInterval(async () => 
	{
		const stats = await videoTransport.getStats();

		console.log('stats of PLAIN video transport ***************', stats);
	}, interval);
};

const createVideoTransport = async (router) => 
{
	videoTransport = await router.createPlainTransport(
		{ 
			listenIp : '127.0.0.1',
			rtcpMux  : false,
			comedia  : true
		});
      
	// Read the transport local RTP port.
	videoRtpPort = videoTransport.tuple.localPort;  
	// Read the transport local RTCP port.
	videoRtcpPort = videoTransport.rtcpTuple.localPort;

	console.log(`videoRtpPort: ${videoRtpPort}, videoRtcpPort: ${videoRtcpPort}`);

	await videoTransport.enableTraceEvent([ 'probation' ]);

	videoTransport.on('trace', (trace) =>
	{
		console.log('tracing PLAIN video transport#################', trace);
	});
	initiateGetStats(5000);
	
	return { videoTransport, videoRtpPort, videoRtcpPort };
};

const produceRtpStream = async () => 
{

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
	
	/** comand to run ffmpeg on comand line */
	return videoProducer;

};

module.exports = { produceRtpStream, createVideoTransport };