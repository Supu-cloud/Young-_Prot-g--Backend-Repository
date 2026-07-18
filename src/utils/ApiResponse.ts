export class ApiResponse<T> {
  success: boolean;
  message: string;
  data:    T | null;

  constructor(success: boolean, message: string, data: T | null = null) {
    this.success = success;
    this.message = message;
    this.data    = data;
  }

  static ok<T>(data: T, message = 'Success') {
    return new ApiResponse(true, message, data);
  }

  static fail(message: string) {
    return new ApiResponse(false, message, null);
  }
}