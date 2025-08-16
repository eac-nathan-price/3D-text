export interface TextStyle {
  id: string;
  name: string;
  fontUrl: string;
  fontSize: number;
  textColor: string;
  backgroundColor: string;
  textAlign: 'left' | 'center' | 'right';
  boundingBox: {
    width: number;
    height: number;
    depth: number;
  };
  backgroundShape: 'rectangle' | 'circle' | 'pill';
  backgroundHeight: number;
  textHeight: number;
  padding: number;
  lineHeight: number;
}