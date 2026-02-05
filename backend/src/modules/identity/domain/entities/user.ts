export type UserProps = {
  id: string;
  email: string | null;
  fullName: string | null;
  isActive: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export class User {
  private props: UserProps;

  constructor(props: UserProps) {
    this.props = props;
  }

  get id() {
    return this.props.id;
  }

  get email() {
    return this.props.email;
  }

  get fullName() {
    return this.props.fullName;
  }

  get isActive() {
    return this.props.isActive;
  }
}