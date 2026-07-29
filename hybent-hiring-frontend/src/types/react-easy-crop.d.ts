declare module 'react-easy-crop' {
  import { Component } from 'react';

  export interface Point {
    x: number;
    y: number;
  }

  export interface Area {
    width: number;
    height: number;
    x: number;
    y: number;
  }

  export interface CropperProps {
    image?: string;
    video?: string;
    crop: Point;
    zoom: number;
    rotation?: number;
    aspect?: number;
    minZoom?: number;
    maxZoom?: number;
    cropShape?: 'rect' | 'round';
    cropSize?: { width: number; height: number };
    showGrid?: boolean;
    zoomSpeed?: number;
    onCropChange: (crop: Point) => void;
    onZoomChange?: (zoom: number) => void;
    onRotationChange?: (rotation: number) => void;
    onCropComplete?: (croppedArea: Area, croppedAreaPixels: Area) => void;
    onImgError?: () => void;
    onCropAreaChange?: (croppedArea: Area, croppedAreaPixels: Area) => void;
    style?: {
      containerStyle?: React.CSSProperties;
      mediaStyle?: React.CSSProperties;
      cropAreaStyle?: React.CSSProperties;
    };
    classes?: {
      containerClassName?: string;
      mediaClassName?: string;
      cropAreaClassName?: string;
    };
    restrictPosition?: boolean;
    mediaProps?: React.ImgHTMLAttributes<HTMLElement> | React.VideoHTMLAttributes<HTMLElement>;
  }

  export default class Cropper extends Component<CropperProps> {}
}
