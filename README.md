# UofC Schedule to Google Calendar

## Description

A web app for quickly turning a UofC schedule into a Google calendar. I have it hosted on [my site](http://schedule.blakemealey.ca). I made a [Trello page](https://trello.com/b/uSXlQs6L/uoc-course-planning-tools) which describes this project and it's goals as well as some other projects I have planned which are related to it.

Really the only feature I did not implement which was in the original Trello plan was the by-course colour system. The main reason for not implementing it was that I could not come up with a good UI for it. I also don't think it would be particularly useful anyways, so I am ok with it not being implemented. If anyone actually uses this and someone requests this feature I may reconsider.

As for future features, besides maybe making the site itself mobile-friendly, there isn't anything I can think of to add to it. If you check out the Trello, you will see the list for a "Better DNDN" site, which I would love to make at some point. That would be a much more ambitious project, but perhaps if I teamed up with someone or even a group of people it might happen. I know there is definitely a demand for something like that, and a donation button might be worth the effort (as well as the learning experience ofc).

I should also give props to [this tutorial](http://cwbuecheler.com/web/tutorials/2013/node-express-mongo/) which got me started with Express.js! Without it, this app wouldn't exist.

I also intend on writing a blog post about this on my [website](http://blakemealey.ca) which goes more in-depth about the project's goals and outcomes because I learned _a lot_ making this project.

## Setup

If you want to run this yourself, make sure you have npm and nodejs installed and navigate to the folder you have saved the project in in your terminal, then run the commands:

	npm install
	npm start

The server should start up and you will be able to view it by going to [localhost:3000](http://localhost:3000) in your browser.