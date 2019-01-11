import Constants from '../constants';
import Song from '../models/song';
import Utilities from '../utilities';
import Youtube from './youtube';
import ItunesCountry from '../itunes_country';

export default class Itunes {
  static chartUrl(options) {
    options = options || {};
    options.limit = options.limit || 20;
    const countryCode = ItunesCountry.current();
    const genreSection = options.genreCode ? `/genre=${options.genreCode}` : '';
    return `/itunes/${countryCode}/rss/topsongs/limit=20${genreSection}/json`;
  }

  static search(searchTerm) {
    searchTerm = encodeURI(searchTerm);
    let url = `/itunes/search?term=${searchTerm}&entity=song&limit=50&country=` + ItunesCountry.current();
    return fetch(url)
    .then(Utilities.fetchToJson)
    .then((data) => {
      console.log(data);
      return Promise.all(
        data.results.map(this._getYoutubeTrackForSong)
      ).then((items) => items.filter(item => item));
    }).then(this._removeDuplicates);
  }

  static fetchCover(song) {
    let searchTerm = encodeURI(`${song.title} ${song.artist}`);
    let url = `/itunes/search?term=${searchTerm}&entity=song&limit=10&country=` + ItunesCountry.current();
    return fetch(url)
    .then(Utilities.fetchToJson)
    .then(data => {
      if (data.resultCount && this._isResultClose(song, data.results[0])) {
        return data.results[0].artworkUrl100.replace('100x100', '600x600');
      } else {
        throw new Error('Unable to find coverart from itunes');
      }
    });
  }

  static fetchChart(options) {
    return fetch(Itunes.chartUrl(options))
    .then(Utilities.fetchToJson)
    .then(data => {
      if (!data || !data.feed || !data.feed.entry || data.feed.entry.length === 0) {
        return [];
      } else {
        return data.feed.entry.map(entry => {
          return new Song({
            title: entry['im:name'].label,
            artist: entry['im:artist'].label,
            album: entry['im:collection']['im:name'].label,
            cover: entry['im:image'][0].label.replace(/\/\d\dx\d\d/, '/600x600'),
            deferred: true
          });
        });
      }
    });
  }

  static _getYoutubeTrackForSong(song) {
    return Youtube.search(song.trackName + ' ' + song.artistName, {
      requestDurations: false,
      addThumbnail: false,
      maxResults: 1
    }).then(items => items[0])
    .then(item => {
      if (!item) {
        return;
      }
      item.title = song.trackName;
      item.artist = song.artistName;
      item.cover = song.artworkUrl100.replace('100x100', '600x600');
      item.album = song.collectionName;
      item.discNumber = song.discNumber;
      item.trackNumber = song.trackNumber;
      return new Song(item);
    });
  }

  static _isResultClose(song, result) {
    let durationSeconds = result.trackTimeMillis / 1000;
    return (
      song.duration < durationSeconds + Constants.VARIANCE_FACTOR &&
      song.duration > durationSeconds - Constants.VARIANCE_FACTOR
    );
  }

  static _removeDuplicates(items) {
    const ids = [];
    return items.filter(item => {
      if (ids.indexOf(item.id) != -1) {
        return false;
      }
      ids.push(item.id);
      return true;
    });
  }
}
