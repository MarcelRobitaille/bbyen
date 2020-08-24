# Bring Back YouTube Email Notifications!

## Why?

In August 2020, YouTube removed the feature of sending email notifications when a subscriber uploads a video. Many watchers, myself included, prefer email notifications to app notifications. Here are some reasons why email notifications so great:

- Save videos for later
- Delete emails of videos you never want to watch
- Define filtering rules to automatically delete certain emails
- YouTube has been known to not always send notifications for all subscribers

This project aims to provide a replacement to YouTube's email notifications. Running this small program checks all your subscribers and sends emails with the links to new videos.

## How it works

It uses the [YouTube Data API](https://developers.google.com/youtube/v3/) to get a list of your subscribers and uses [RSS feeds](https://support.google.com/youtube/answer/6224202?hl=en) to get each channel's recent uploads. A database of videos for which an email has already been sent is kept in order to not notify about the same video twice. To send emails, the program connects to an email account through SMTP.

## Requirements

- [node.js](https://nodejs.org/en/) >= 14
- [git](https://git-scm.com/) (used during setup to download the project)

## Installation and setup

1. Download the source code

	```
	git clone https://github.com/Iambecomeroot/bbyen.git
	```

1. Download packages

	```
	npm install --production
	```

1. Populate the `config.json` file

	```
	mv config.example.json config.json
	```

	Then update `email.host`, `email.auth`, and `email.sendingContact`. These are the settings to send email over SMTP.

	Change `email.destination` to the email address where videos should be sent.

	Optionally change `timers.subscriptions` and `timers.videos` to configure how often your list of subscriptions is updated and how often new videos are checked for emailed about respectively.

1. Set up Google API credentials

	The credentials have to be made on your personal account. This is the source of your subscriptions.

	1. Go to https://console.developers.google.com and create a new project

	1. Go to https://console.developers.google.com/apis/credentials and create OAuth 2.0 Client credentials

	1. Download the credentaisl JSON file and save it as `google-credentials.json` in the folder where you downloaded the project.

	1. Go to https://console.developers.google.com/apis/library, search for and click "YouTube Data API v3", and enable this api.

## Running

Run the project with:
```
node src/index.js
```

On the first run, the app will have to authenticate. A link will be printed. Open it in your browser and follow the instructions. Finally, the website will give a code. Copy this code and paste it back in the terminal.

## Alternatives

It is possible to manually set up RSS feeds for each channel you are interested in. It is a very lengthy process.

1. Find the id of the channel.
1. Get the URL to the RSS feed: https://www.youtube.com/feeds/videos.xml?channel_id=<channelId\>
1. Put this URL in an RSS reader (such as [blogtrottr.com](https://blogtrottr.com))

Here are some advantages of BBYEN over manually configuring RSS feeds:

- No ads.
- You don't have to manually go through all your subscriptions. It will automatically find all subscriptions you have notifications for.
- It will automatically detect new subscriptions and unsubscriptions.
