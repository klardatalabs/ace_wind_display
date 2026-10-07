// Icons from Icons8's Line Awesome set (MIT / Good Boy License), bundled locally so
// hoardings work offline. Add an icon by importing its SVG below.

import wind from "line-awesome/svg/wind-solid.svg?raw";
import bolt from "line-awesome/svg/bolt-solid.svg?raw";
import leaf from "line-awesome/svg/leaf-solid.svg?raw";
import home from "line-awesome/svg/home-solid.svg?raw";
import school from "line-awesome/svg/school-solid.svg?raw";
import graduation from "line-awesome/svg/graduation-cap-solid.svg?raw";
import users from "line-awesome/svg/users-solid.svg?raw";
import code from "line-awesome/svg/code-solid.svg?raw";
import terminal from "line-awesome/svg/terminal-solid.svg?raw";
import qrcode from "line-awesome/svg/qrcode-solid.svg?raw";
import comments from "line-awesome/svg/comments.svg?raw";
import commentDots from "line-awesome/svg/comment-dots.svg?raw";
import robot from "line-awesome/svg/robot-solid.svg?raw";
import chart from "line-awesome/svg/chart-line-solid.svg?raw";
import tree from "line-awesome/svg/tree-solid.svg?raw";
import sun from "line-awesome/svg/sun.svg?raw";
import moon from "line-awesome/svg/moon.svg?raw";
import arrowRight from "line-awesome/svg/arrow-right-solid.svg?raw";
import play from "line-awesome/svg/play-solid.svg?raw";
import eye from "line-awesome/svg/eye.svg?raw";
import cogs from "line-awesome/svg/cogs-solid.svg?raw";
import database from "line-awesome/svg/database-solid.svg?raw";
import mapPin from "line-awesome/svg/map-marker-alt-solid.svg?raw";
import heart from "line-awesome/svg/hand-holding-heart-solid.svg?raw";
import seedling from "line-awesome/svg/seedling-solid.svg?raw";
import gauge from "line-awesome/svg/tachometer-alt-solid.svg?raw";
import plug from "line-awesome/svg/plug-solid.svg?raw";
import industry from "line-awesome/svg/industry-solid.svg?raw";
import lightbulb from "line-awesome/svg/lightbulb.svg?raw";
import book from "line-awesome/svg/book-open-solid.svg?raw";
import github from "line-awesome/svg/github.svg?raw";
import copy from "line-awesome/svg/copy.svg?raw";
import check from "line-awesome/svg/check-solid.svg?raw";
import close from "line-awesome/svg/times-solid.svg?raw";
import menu from "line-awesome/svg/bars-solid.svg?raw";
import globe from "line-awesome/svg/globe-europe-solid.svg?raw";
import cube from "line-awesome/svg/cube-solid.svg?raw";
import layers from "line-awesome/svg/layer-group-solid.svg?raw";
import microchip from "line-awesome/svg/microchip-solid.svg?raw";
import handPointer from "line-awesome/svg/hand-pointer.svg?raw";
import search from "line-awesome/svg/search-solid.svg?raw";
import fan from "line-awesome/svg/fan-solid.svg?raw";
import thermometer from "line-awesome/svg/thermometer-half-solid.svg?raw";
import clock from "line-awesome/svg/clock.svg?raw";
import calendar from "line-awesome/svg/calendar.svg?raw";
import download from "line-awesome/svg/cloud-download-alt-solid.svg?raw";
import cloud from "line-awesome/svg/cloud-sun-solid.svg?raw";
import child from "line-awesome/svg/child-solid.svg?raw";

const ICONS = {
  wind, bolt, leaf, home, school, graduation, users, code, terminal, qrcode, comments, commentDots,
  robot, chart, tree, sun, moon, arrowRight, play, eye, cogs, database, mapPin, heart, seedling, gauge,
  plug, industry, lightbulb, book, github, copy, check, close, menu, globe, cube, layers, microchip,
  handPointer, search, fan, thermometer, clock, calendar, download, cloud, child,
};

const withCurrentColor = Object.fromEntries(
  Object.entries(ICONS).map(([k, svg]) => [k, svg.replace("<svg ", '<svg fill="currentColor" width="100%" height="100%" ')])
);

export default function Icon({ name, className = "size-5", title }) {
  const svg = withCurrentColor[name];
  if (!svg) return null;
  return (
    <span
      className={`inline-block shrink-0 ${className}`}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
