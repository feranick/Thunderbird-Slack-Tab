# Google Chat Tab
Unofficial Slack add-on for Thunderbird, it adds a button in Spaces that opens a Slack web tab in Thunderbird. It also allows to copy a text in Thunderbird, and share it to a Slack chat through a contextual menu.
The [home page](https://addons.thunderbird.net/en-US/thunderbird/addon/slack-spaces-tab/) of the extension contains the latest code.

#### Installing 
A new Slack icon should appear in the Spaces Toolbar of Thunderbird. Click to open. 

#### Installing from sources
Download the repository, zip it, rename it to Slack-Tab.xpi and choose install addon from file in Thunderbird.

In linux the xpi file can be created with the following commands
* `git clone https://github.com/feranick/Thunderbird-Slack-Tab`
* `cd ./Thunderbird-Slack-Tab`
* `VERSION=$(cat ./manifest.json | jq --raw-output '.version')`
* `zip -r "../Slack-Tab-${VERSION}-tb.xpi" *`
