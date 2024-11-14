# Bring Back YouTube Email Notifications!

[Homepage](https://github.com/MarcelRobitaille/bbyen)

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

- [Docker](https://www.docker.com/)

or

- [node.js](https://nodejs.org/en/) >= 15 (20 recommended)
- [git](https://git-scm.com/) (used during setup to download the project)

## Installation and setup

There are two methods to run this software.
You may run it on bare metal, or take advantage of the Docker image published to Docker Hub.

### Bare metal

1. Download the source code

	```
	git clone https://github.com/MarcelRobitaille/bbyen.git
	```

1. Download packages

	```
	npm install --production
	```

1. Copy the template configuration file and save it as `config.json`
	```
	cp config.example.json config.json
	```

1. [Perform the initial configuration](#initial-configuration)

### Docker

1. Create an empty folder on your computer
	```
	mkdir -p ~/docker/bbyen
	cd ~/docker/bbyen
	```
1. Copy the `docker-compose.yml` from this repository to that folder
	```
	wget https://raw.githubusercontent.com/MarcelRobitaille/bbyen/master/docker-compose.yml
	```
1. Copy the configuration file template and save it as `config.json`
	```
	wget https://raw.githubusercontent.com/MarcelRobitaille/bbyen/master/config.example.json \
	  -O config.json
	```
1. [Perform the initial configuration](#initial-configuration)

## Initial Configuration

After installing the software using either the bare metal or Docker method,
it is mandatory to configure certain values and to set up Google API credentials.

1. Populate the `config.json` file

	Update `email.host`, `email.auth`, and `email.sendingContact`. These are the settings to send email over SMTP.

	Change `email.destination` to the email address where videos should be sent.

	Optionally change `timers.subscriptions` and `timers.videos` to configure how often your list of subscriptions is updated and how often new videos are checked for emailed about respectively.

1. Set up Google API credentials

	The credentials have to be made on your personal account. This is the source of your subscriptions.

	1. Go to https://console.developers.google.com and create a new project

	1. Go to https://console.developers.google.com/apis/credentials and create OAuth 2.0 Client credentials

		1. Click "Create Credentials" and then "OAuth client ID"
		![Create Credentials Options](./docs/oauth_create_credentials.png)

		1. Select "Desktop app" for "Application type"
		![Create Credentials Application Type](./docs/oauth_application_type.png)

		1. Click "Create"

	1. Click the download button next to the new OAuth 2.0 Client ID.
	Download the credentials JSON file and save it as `google-credentials.json` in the folder where you downloaded the project.
	![OAuth Credentials Download](./docs/oauth_download.png)

	1. Go to https://console.developers.google.com/apis/library, search for and click "YouTube Data API v3", and enable this api.

## Running

### Bare Metal

```
npm start
```

### Docker
```
sudo docker-compose up
```

## Authentication

On the first run, you will need to authenticate the app, tying it to your Google account (the subscriptions will come from whatever account you use):
1. A browser window should open automatically. If not, or if the system is headless, the URL will be printed in the console. Copy/paste it into a new tab.
1. Follow the instructions on this page.
1. You may have to click "Advanced" and "Got to bbyen (unsafe)". This is because the app hasn't been verified, but the server is trustworthy (you are running it).
1. After authenticating in the website, Google should automatically redirect you to your server, which will transfer the authentication code. In this case you will see a message "Authorization successful. You may now close this tab.".
If this does not work (if you see "Unable to connect"), please copy/paste the URL from the browser address bar into the console.

## Advanced Configuration

### Channel Whitelist and Blacklist

In some instances, you may want to stop receiving notifications from a list of channels (blacklist)
or only receive notifications from a list of channels (whitelist).
Unfortunately, there is no way to check the notification status (bell icon set to "all", "personalized", or "none") from the API.
Thus, blacklist and whitelist options were added to the configuration file.

You can use the keys `blacklistedChannelIds` and `whitelistedChannelIds` in the top level of `config.json`.
These should be arrays of the channel IDs you want to include/exclude.
For example:
```json
{
	"email": {},
	...
	"blacklistedChannelIds": [ "xxx", "yyy" ],
	"whitelistedChannelIds": [ "zzz" ]
}
```
If the key `whitelistedChannelIds` is present, notifications will only be sent for those channels.
If `blacklistedChannelIds` is present, any notifications that would be sent for channels are skipped.

The channel ID is usually at the end of the URL of the channel's page.
However, sometimes this is not the true ID but some customized shorter and readable string.
In this case, you may:
- Paste the entire channel page URL into the config. Note that the next time you run the software, this will be replaced with the channel ID so this conversion only has to happen once (it uses the API so there is a small cost to this).
- Run `copy(window.ytInitialData.metadata.channelMetadataRenderer.externalId)` in the developer console. On the channel page, press F12, click "Console", and paste this command. The channel ID will get copied to your clipboard.
- You may also find the channel ID by looking in the database file.

This is admittedly a manual and complicated process.
That is because this feature is indented for advanced users.
If there is demand, I will consider a more user-friendly implementation.

Please see #6 for more information on this.

## Alternatives

It is possible to manually set up RSS feeds for each channel you are interested in. It is a very lengthy process.

1. Find the id of the channel.
1. Get the URL to the RSS feed: https://www.youtube.com/feeds/videos.xml?channel_id=<channelId\>
1. Put this URL in an RSS reader (such as [blogtrottr.com](https://blogtrottr.com))

Here are some advantages of BBYEN over manually configuring RSS feeds:

- No ads.
- You don't have to manually go through all your subscriptions. It will automatically find all subscriptions you have notifications for.
- It will automatically detect new subscriptions and unsubscriptions.

## Contributing

Pull requests welcome.

I also accept donations, but please consider other, more worthy causes.

[![PayPal](https://img.shields.io/badge/PayPal-00457C?style=for-the-badge&logo=paypal&logoColor=white)](https://www.paypal.com/donate/?business=YURJXF4KG96YA&no_recurring=0&item_name=Open+source+software&currency_code=CAD)

## Development

### Docker

Building the docker image:
```
sudo docker build . -t marcel/bbyen
```

I had to use `--network host` to have `npm install` work correctly without timing out:
```
sudo docker build . -t marcel/bbyen --network host
```
