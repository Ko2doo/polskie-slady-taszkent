import { PHOTO_SIZE, PhotoPickerError, chooseFromGallery, takePhoto } from '@/capacitor/services/photoPicker';
import { LIMITS } from '@/services/customPointsFormat';
import { deletePhotoFiles, deletePointPhotos, pruneUnreferenced, savePhoto } from '@/services/customPointsPhotos';
import { createLogger, IS_DEBUG } from '@/utils/debugMode';

const photoSessionLogger = createLogger('PhotoSession');

/**
 * Photo session: the photos of ONE form (the map editor dialog), from the moment it opens until it is saved,
 * cancelled or deleted.
 *
 * Why a session: a photo is saved to the app storage the moment it is taken, but it belongs to the point only
 * when the form is saved. So the session remembers which photos were added in it, and:
 *   - save   -> commit(): the files that are not in the saved list (removed photos) are deleted
 *   - cancel -> discard(): the photos added in this session are deleted, the original ones stay
 *   - a new point has no id yet, so the form creates one when it opens (`isNew`), and the photos go to the folder
 *     of that id. A cancelled new point loses the whole folder.
 *
 * Use one session per form: `const photoSession = createPhotoSession();`
 *
 * Usage:
 *   photoSession.begin({ pointId, photos, isNew });   // the form opened
 *   await photoSession.add('camera' | 'gallery');     // returns { status, added }
 *   photoSession.remove(path);
 *   photoSession.commit();                            // the point was saved with photoSession.photos
 *   photoSession.discard();                           // the form was cancelled
 *   photoSession.end();                               // the point was deleted: nothing is left to clean up
 */
export function createPhotoSession() {
  let pointId = $state(null);
  let photos = $state([]);
  let isBusy = $state(false);

  let isNew = false;
  let added = []; // photos saved in this session that are not saved with the point yet

  // Changes when the session ends or a new one begins: a pick that finishes later must not touch the new state
  let generation = 0;

  function log(label) {
    return (error) => {
      IS_DEBUG && photoSessionLogger.error(`${label}:`, error);
    };
  }

  function end() {
    generation += 1;

    pointId = null;
    photos = [];
    isNew = false;
    added = [];
  }

  /**
   * Delete what this session added and end it. The files are deleted in the background.
   * @returns {Promise<void>}
   */
  async function discard() {
    const id = pointId;
    const wasNew = isNew;
    const files = added;

    end();

    if (!id) return;

    try {
      if (wasNew) await deletePointPhotos(id);
      else if (files.length > 0) await deletePhotoFiles(files);
    } catch (error) {
      log('Failed to discard the photos')(error);
    }
  }

  /**
   * @param {Object} options
   * @param {string} options.pointId - Id of the point (for a new point: an id created in advance)
   * @param {Array<string>} options.photos - Photos the point already has
   * @param {boolean} options.isNew - The point is not saved yet
   */
  function begin({ pointId: id, photos: list, isNew: isNewPoint }) {
    // A form that was not finished: its unsaved photos are not needed any more
    discard();

    pointId = id;
    photos = [...list];
    isNew = isNewPoint;
    added = [];
  }

  async function pick(kind, free) {
    return kind === 'camera' ? takePhoto() : chooseFromGallery(free);
  }

  /**
   * Add photos from the camera or the gallery
   * @param {'camera'|'gallery'} kind - Where the photos come from
   * @returns {Promise<{ status: 'ok'|'truncated'|'cancelled'|'limit'|'busy'|'denied'|'failed', added: number }>}
   *   truncated: more photos came than there was room for (the extra ones were ignored)
   */
  async function add(kind) {
    if (!pointId || isBusy) return { status: 'busy', added: 0 };
    if (photos.length >= LIMITS.maxPhotos) return { status: 'limit', added: 0 };

    const current = generation;
    const id = pointId;
    const free = LIMITS.maxPhotos - photos.length;
    let count = 0;

    isBusy = true;

    try {
      const sources = await pick(kind, free);

      if (current !== generation || sources.length === 0) return { status: 'cancelled', added: 0 };

      const accepted = sources.slice(0, free);

      for (const source of accepted) {
        const path = await savePhoto({ pointId: id, source, resize: PHOTO_SIZE });

        // The form was closed while the photo was being saved: nobody needs it
        if (current !== generation) {
          Promise.resolve(deletePhotoFiles([path])).catch(log('Failed to delete a photo of a closed form'));
          return { status: 'cancelled', added: count };
        }

        photos.push(path);
        added.push(path);
        count += 1;
      }

      return { status: accepted.length < sources.length ? 'truncated' : 'ok', added: count };
    } catch (error) {
      log('Failed to add a photo')(error);

      return { status: error instanceof PhotoPickerError ? error.kind : 'failed', added: count };
    } finally {
      isBusy = false;
    }
  }

  /**
   * Remove a photo from the list. A photo that was added in this session is deleted at once,
   * an original one stays on the disk until the point is saved (a cancel brings it back).
   * @param {string} path - Photo path
   */
  function remove(path) {
    const index = photos.indexOf(path);

    if (index === -1) return;

    photos.splice(index, 1);

    const addedIndex = added.indexOf(path);

    if (addedIndex !== -1) {
      added.splice(addedIndex, 1);
      Promise.resolve(deletePhotoFiles([path])).catch(log('Failed to delete a photo'));
    }
  }

  /**
   * The point was saved with the current photos: delete the files that are not in the list and end the session.
   * @returns {Promise<void>}
   */
  async function commit() {
    const id = pointId;
    const keep = [...photos];

    end();

    if (!id) return;

    try {
      await pruneUnreferenced(id, keep);
    } catch (error) {
      log('Failed to clean up the photos')(error);
    }
  }

  return {
    get pointId() {
      return pointId;
    },
    get photos() {
      return photos;
    },
    get isBusy() {
      return isBusy;
    },
    get freeSlots() {
      return LIMITS.maxPhotos - photos.length;
    },
    get canAdd() {
      return Boolean(pointId) && !isBusy && photos.length < LIMITS.maxPhotos;
    },

    begin,
    add,
    remove,
    commit,
    discard,
    end,
  };
}
